import type { Location } from "./locations";
import { levelRank, meetsLevel, type Level } from "./levels";

const HOUR_MS = 60 * 60 * 1000;

/** The sender needs time to hand the document over before the flight. */
export const HANDOFF_BUFFER_MS = 12 * HOUR_MS;
/** The traveller needs time after landing to reach the recipient. */
export const LAST_MILE_BUFFER_MS = 24 * HOUR_MS;

export type MatchableRequest = {
  origin: Location;
  destination: Location;
  /** When the document is ready to hand over. */
  availableFrom: Date;
  deadline: Date;
  minLevel: Level;
};

export type MatchableTrip = {
  origin: Location;
  destination: Location;
  departureAt: Date;
  arrivalAt: Date;
  capacityRemaining: number;
  /** null when the traveller is not verified and cannot carry documents. */
  travellerLevel: Level | null;
};

export type Ineligibility =
  | "ROUTE"
  | "DEPARTS_TOO_SOON"
  | "DEPARTS_BEFORE_DOCUMENT_READY"
  | "ARRIVES_TOO_LATE"
  | "FULL"
  | "NOT_VERIFIED"
  | "LEVEL";

export function ineligibilityReasons(
  req: MatchableRequest,
  trip: MatchableTrip,
  now: Date = new Date(),
): Ineligibility[] {
  const reasons: Ineligibility[] = [];
  if (req.origin !== trip.origin || req.destination !== trip.destination) reasons.push("ROUTE");
  if (trip.departureAt.getTime() - now.getTime() < HANDOFF_BUFFER_MS) {
    reasons.push("DEPARTS_TOO_SOON");
  }
  if (trip.departureAt.getTime() - req.availableFrom.getTime() < HANDOFF_BUFFER_MS) {
    reasons.push("DEPARTS_BEFORE_DOCUMENT_READY");
  }
  if (trip.arrivalAt.getTime() + LAST_MILE_BUFFER_MS > req.deadline.getTime()) {
    reasons.push("ARRIVES_TOO_LATE");
  }
  if (trip.capacityRemaining <= 0) reasons.push("FULL");
  if (trip.travellerLevel === null) reasons.push("NOT_VERIFIED");
  else if (!meetsLevel(trip.travellerLevel, req.minLevel)) reasons.push("LEVEL");
  return reasons;
}

export function isMatch(req: MatchableRequest, trip: MatchableTrip, now?: Date): boolean {
  return ineligibilityReasons(req, trip, now).length === 0;
}

/**
 * Orders eligible trips by traveller level first, then by how much slack they leave
 * before the deadline (earlier arrival is better).
 */
export function rankMatches<T extends MatchableTrip>(
  req: MatchableRequest,
  trips: T[],
  now?: Date,
): T[] {
  return trips
    .filter((t) => isMatch(req, t, now))
    .sort(
      (a, b) =>
        levelRank(b.travellerLevel!) - levelRank(a.travellerLevel!) ||
        a.arrivalAt.getTime() - b.arrivalAt.getTime(),
    );
}
