import type { TrustTier } from "./trust";
import { canCarry } from "./trust";

/**
 * Traveller levels reward a track record. Verification (trust.ts) decides
 * whether someone may carry documents at all. Levels decide how much they earn,
 * how prominently they are matched, and how early they see valuable requests.
 */
export const LEVELS = ["ARINRIN_AJO", "OLOOOTO", "ATONA", "AGBA"] as const;
export type Level = (typeof LEVELS)[number];

export type LevelInfo = {
  name: string;
  meaning: string;
  blurb: string;
  /** Share of Ajo's service fee paid to the traveller as a bonus on completion. */
  feeShare: number;
  /** How long after a request is posted it appears in this level's feed. */
  feedDelayHours: number;
  requirements: {
    deliveries: number;
    /** Average star rating. Only applies once there are at least MIN_RATINGS_TO_COUNT ratings. */
    rating: number;
    /** Share of deliveries made before the deadline. */
    onTimeRate: number;
    /** Upheld disputes and traveller cancellations, as a share of all jobs. */
    maxStrikeRate: number;
    adminApproval: boolean;
  };
};

export const LEVEL_INFO: Record<Level, LevelInfo> = {
  ARINRIN_AJO: {
    name: "Arìnrìn-àjò",
    meaning: "Traveller",
    blurb: "Every verified traveller starts here.",
    feeShare: 0,
    feedDelayHours: 24,
    requirements: { deliveries: 0, rating: 0, onTimeRate: 0, maxStrikeRate: 1, adminApproval: false },
  },
  OLOOOTO: {
    name: "Olóòótọ́",
    meaning: "The Faithful One",
    blurb: "Proven reliable. Senders can reserve requests for Olóòótọ́ and above.",
    feeShare: 0.2,
    feedDelayHours: 12,
    requirements: { deliveries: 3, rating: 4.5, onTimeRate: 0, maxStrikeRate: 0.1, adminApproval: false },
  },
  ATONA: {
    name: "Atọ́nà",
    meaning: "Guide",
    blurb: "A seasoned traveller who shows others the way.",
    feeShare: 0.35,
    feedDelayHours: 4,
    requirements: { deliveries: 10, rating: 4.7, onTimeRate: 0.95, maxStrikeRate: 0.05, adminApproval: false },
  },
  AGBA: {
    name: "Àgbà",
    meaning: "Elder",
    blurb: "The most trusted travellers on Ajo, approved by the Ajo team.",
    feeShare: 0.5,
    feedDelayHours: 0,
    requirements: { deliveries: 25, rating: 4.8, onTimeRate: 0.97, maxStrikeRate: 0.03, adminApproval: true },
  },
};

export const MIN_RATINGS_TO_COUNT = 3;

export type TravellerStats = {
  trustTier: TrustTier;
  completedDeliveries: number;
  onTimeDeliveries: number;
  ratingCount: number;
  ratingSum: number;
  upheldDisputes: number;
  travellerCancellations: number;
  elderApproved: boolean;
};

export const levelRank = (level: Level) => LEVELS.indexOf(level);
export const meetsLevel = (actual: Level, required: Level) => levelRank(actual) >= levelRank(required);

export function averageRating(s: Pick<TravellerStats, "ratingCount" | "ratingSum">): number | null {
  return s.ratingCount > 0 ? s.ratingSum / s.ratingCount : null;
}

export type Check = { label: string; met: boolean; current: string; target: string; progress: number };

/** Each requirement of a level, with how far the traveller is towards it. */
export function levelChecks(level: Level, s: TravellerStats): Check[] {
  const r = LEVEL_INFO[level].requirements;
  const checks: Check[] = [];
  if (r.deliveries > 0) {
    checks.push({
      label: "Completed deliveries",
      met: s.completedDeliveries >= r.deliveries,
      current: String(s.completedDeliveries),
      target: String(r.deliveries),
      progress: Math.min(1, s.completedDeliveries / r.deliveries),
    });
  }
  if (r.rating > 0) {
    const avg = averageRating(s);
    const counts = s.ratingCount >= MIN_RATINGS_TO_COUNT;
    checks.push({
      label: "Average rating",
      met: !counts || (avg ?? 0) >= r.rating,
      current: !counts
        ? `Counts from ${MIN_RATINGS_TO_COUNT} ratings (${s.ratingCount} so far)`
        : `${avg!.toFixed(1)}★`,
      target: `${r.rating}★`,
      progress: !counts ? 1 : Math.min(1, (avg ?? 0) / r.rating),
    });
  }
  if (r.onTimeRate > 0) {
    const rate = s.completedDeliveries ? s.onTimeDeliveries / s.completedDeliveries : 0;
    checks.push({
      label: "On time",
      met: rate >= r.onTimeRate,
      current: `${Math.round(rate * 100)}%`,
      target: `${Math.round(r.onTimeRate * 100)}%`,
      progress: Math.min(1, rate / r.onTimeRate),
    });
  }
  if (r.maxStrikeRate < 1) {
    const strikes = s.upheldDisputes + s.travellerCancellations;
    const jobs = s.completedDeliveries + s.travellerCancellations;
    const rate = jobs ? strikes / jobs : 0;
    checks.push({
      label: "Disputes lost and cancellations",
      met: rate <= r.maxStrikeRate,
      current: `${Math.round(rate * 100)}%`,
      target: `at most ${Math.round(r.maxStrikeRate * 100)}%`,
      progress: rate <= r.maxStrikeRate ? 1 : 0,
    });
  }
  if (r.adminApproval) {
    checks.push({
      label: "Approved by the Ajo team",
      met: s.elderApproved,
      current: s.elderApproved ? "Approved" : "Not yet",
      target: "Approved",
      progress: s.elderApproved ? 1 : 0,
    });
  }
  return checks;
}

/**
 * The highest level whose requirements are all met, or null if the traveller
 * is not verified. Recomputed from stats every time, so levels go down as
 * well as up.
 */
export function levelFor(s: TravellerStats): Level | null {
  if (!canCarry(s.trustTier)) return null;
  let level: Level = "ARINRIN_AJO";
  for (const l of LEVELS) {
    if (levelChecks(l, s).every((c) => c.met)) level = l;
    else break;
  }
  return level;
}

export function nextLevel(level: Level): Level | null {
  return LEVELS[levelRank(level) + 1] ?? null;
}

/** The completion bonus Ajo pays from its own service fee. */
export function levelBonus(level: Level, serviceFee: number): number {
  return Math.floor(serviceFee * LEVEL_INFO[level].feeShare);
}

/** When a request first appears in a traveller's feed. */
export function visibleFrom(postedAt: Date, level: Level): Date {
  return new Date(postedAt.getTime() + LEVEL_INFO[level].feedDelayHours * 60 * 60 * 1000);
}

/** The level of a stored user record. */
export function levelOf(
  u: Omit<TravellerStats, "elderApproved"> & { elderApprovedAt: Date | null },
): Level | null {
  return levelFor({ ...u, elderApproved: u.elderApprovedAt !== null });
}
