export const LOCATIONS = ["LAGOS", "LONDON", "NEW_YORK"] as const;
export type Location = (typeof LOCATIONS)[number];

export const LOCATION_LABELS: Record<Location, string> = {
  LAGOS: "Lagos",
  LONDON: "London",
  NEW_YORK: "New York",
};

export type Currency = "gbp" | "usd";

type Corridor = {
  currency: Currency;
  /** What the traveller earns for carrying one document at standard urgency, in minor units. */
  baseFee: number;
};

// Corridors are symmetric, so the key is the two locations sorted.
// Placeholder prices, to be tuned once real demand data exists.
const CORRIDORS: Record<string, Corridor> = {
  "LAGOS|LONDON": { currency: "gbp", baseFee: 4000 },
  "LAGOS|NEW_YORK": { currency: "usd", baseFee: 5500 },
  "LONDON|NEW_YORK": { currency: "usd", baseFee: 4500 },
};

export function corridorFor(origin: Location, destination: Location): Corridor {
  if (origin === destination) {
    throw new Error("Origin and destination must differ");
  }
  const key = [origin, destination].sort().join("|");
  const corridor = CORRIDORS[key];
  if (!corridor) throw new Error(`Unsupported corridor ${origin} → ${destination}`);
  return corridor;
}

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "gbp" ? "en-GB" : "en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
