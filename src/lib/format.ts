import type { Location } from "@/lib/domain/locations";
import { formatAtLocation } from "@/lib/domain/time";

/** A time that belongs to a city, e.g. a departure: "Thu, 12 Nov 2026, 18:20 Lagos time". */
export const formatAt = (date: Date, location: Location) => formatAtLocation(date, location);

/** A calendar date where the hour doesn't matter: "12 Nov 2026". */
export function formatDay(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}
