import { LOCATION_LABELS, type Location } from "./locations";

/**
 * Times belong to a place. A trip's departure is shown and entered in the origin's local
 * time and its arrival in the destination's, like an airline ticket. A request's handover
 * time uses the origin and its deadline the destination. Everything is stored in UTC.
 */
export const LOCATION_TIMEZONES: Record<Location, string> = {
  LAGOS: "Africa/Lagos",
  LONDON: "Europe/London",
  NEW_YORK: "America/New_York",
};

/** The longest a journey can take, connections included, before the form rejects it. */
export const MAX_JOURNEY_HOURS = 48;

/** Returns a reason the journey times look wrong, or null if they are fine. */
export function journeyProblem(departureAt: Date, arrivalAt: Date): string | null {
  const hours = (arrivalAt.getTime() - departureAt.getTime()) / 3_600_000;
  if (hours <= 0) return "Arrival must be after departure";
  if (hours > MAX_JOURNEY_HOURS) {
    return `That journey takes ${Math.round(hours)} hours. Check the arrival date: a trip can take at most ${MAX_JOURNEY_HOURS / 24} days.`;
  }
  return null;
}

/** The UTC offset of a timezone at an instant, in milliseconds (Lagos is +3_600_000). */
function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * Converts a wall-clock time in a timezone ("2026-11-12T18:20", as an
 * <input type="datetime-local"> sends it) to the UTC instant. Returns null if unreadable.
 * A time skipped by a clock change resolves to just after the change.
 */
export function zonedTimeToUtc(wallTime: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(wallTime);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m.map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s || 0);
  if (Number.isNaN(asUtc)) return null;
  // Two passes settle the offset when the first guess lands on the other side of a clock change.
  const first = asUtc - offsetMs(asUtc, timeZone);
  return new Date(asUtc - offsetMs(first, timeZone));
}

/** "Thu, 12 Nov 2026, 18:20" in the given timezone. */
export function formatInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** "Thu, 12 Nov 2026, 18:20 Lagos time" */
export function formatAtLocation(date: Date, location: Location): string {
  return `${formatInZone(date, LOCATION_TIMEZONES[location])} ${LOCATION_LABELS[location]} time`;
}
