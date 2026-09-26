import { corridorFor, type Currency, type Location } from "./locations";
import { urgencyRule, type UrgencyTier } from "./urgency";

export type Quote = {
  currency: Currency;
  urgency: UrgencyTier;
  /** What the traveller receives across all milestones. */
  travellerPayout: number;
  /** Ajo's fee, charged to the sender on top of the payout. */
  serviceFee: number;
  /** What the sender pays. */
  total: number;
};

// Marginal service-fee bands, applied like tax brackets to the traveller payout (minor units).
export const SERVICE_FEE_BANDS: readonly { upTo: number; rate: number }[] = [
  { upTo: 5000, rate: 0.15 },
  { upTo: 10000, rate: 0.12 },
  { upTo: Infinity, rate: 0.1 },
];
export const MIN_SERVICE_FEE = 300;

export function serviceFeeFor(payout: number): number {
  let fee = 0;
  let lower = 0;
  for (const band of SERVICE_FEE_BANDS) {
    if (payout <= lower) break;
    fee += (Math.min(payout, band.upTo) - lower) * band.rate;
    lower = band.upTo;
  }
  return Math.max(MIN_SERVICE_FEE, Math.round(fee));
}

export function quote(input: {
  origin: Location;
  destination: Location;
  deadline: Date;
  now?: Date;
}): Quote {
  const corridor = corridorFor(input.origin, input.destination);
  const rule = urgencyRule(input.deadline, input.now);
  const travellerPayout = Math.round(corridor.baseFee * rule.feeMultiplier);
  const serviceFee = serviceFeeFor(travellerPayout);
  return {
    currency: corridor.currency,
    urgency: rule.tier,
    travellerPayout,
    serviceFee,
    total: travellerPayout + serviceFee,
  };
}
