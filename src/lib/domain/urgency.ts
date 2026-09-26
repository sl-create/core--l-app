const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const URGENCY_TIERS = ["STANDARD", "PRIORITY", "EXPRESS", "URGENT"] as const;
export type UrgencyTier = (typeof URGENCY_TIERS)[number];

type TierRule = {
  tier: UrgencyTier;
  /** The tier applies while at least this much time is left before the deadline. */
  minTimeLeftMs: number;
  /** How long the other party has to confirm or dispute a milestone claim. */
  claimWindowHours: 72 | 48 | 24 | 12;
  /** Multiplier applied to the corridor's base fee. */
  feeMultiplier: number;
};

// Ordered from most to least time remaining.
export const TIER_RULES: readonly TierRule[] = [
  { tier: "STANDARD", minTimeLeftMs: 14 * DAY_MS, claimWindowHours: 72, feeMultiplier: 1 },
  { tier: "PRIORITY", minTimeLeftMs: 7 * DAY_MS, claimWindowHours: 48, feeMultiplier: 1.25 },
  { tier: "EXPRESS", minTimeLeftMs: 3 * DAY_MS, claimWindowHours: 24, feeMultiplier: 1.5 },
  { tier: "URGENT", minTimeLeftMs: 0, claimWindowHours: 12, feeMultiplier: 2 },
];

export function urgencyRule(deadline: Date, now: Date = new Date()): TierRule {
  const timeLeft = deadline.getTime() - now.getTime();
  return TIER_RULES.find((r) => timeLeft >= r.minTimeLeftMs) ?? TIER_RULES[TIER_RULES.length - 1];
}

/**
 * The claim window for a milestone claimed at `now`. It is recomputed at claim
 * time, so windows shrink as the deadline approaches.
 */
export function claimWindowHours(deadline: Date, now: Date = new Date()): number {
  return urgencyRule(deadline, now).claimWindowHours;
}

export function claimWindowEndsAt(deadline: Date, claimedAt: Date = new Date()): Date {
  return new Date(claimedAt.getTime() + claimWindowHours(deadline, claimedAt) * HOUR_MS);
}
