const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const CANCELLATION_POLICIES = ["FLEXIBLE", "MODERATE", "STRICT"] as const;
export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[number];

export const CANCELLATION_POLICY_DESCRIPTIONS: Record<CancellationPolicy, string> = {
  FLEXIBLE:
    "Full refund up to 24 hours before departure. After that, half the traveller fee is refunded.",
  MODERATE:
    "Full refund up to 5 days before departure. After that, half the traveller fee is refunded.",
  STRICT:
    "Full refund within 48 hours of booking if departure is at least 14 days away. Half the traveller fee is refunded up to 7 days before departure. No refund after that.",
};

export type Refund = {
  /** Refunded to the sender from the traveller's share. */
  travellerPayoutRefund: number;
  /** Refunded to the sender from Ajo's service fee. */
  serviceFeeRefund: number;
  total: number;
  reason: string;
};

type Booking = {
  policy: CancellationPolicy;
  travellerPayout: number;
  serviceFee: number;
  bookedAt: Date;
  departureAt: Date;
};

function refund(b: Booking, share: 0 | 0.5 | 1, reason: string): Refund {
  const travellerPayoutRefund = Math.round(b.travellerPayout * share);
  // Like Airbnb, the service fee comes back only when the refund is full.
  const serviceFeeRefund = share === 1 ? b.serviceFee : 0;
  return {
    travellerPayoutRefund,
    serviceFeeRefund,
    total: travellerPayoutRefund + serviceFeeRefund,
    reason,
  };
}

/**
 * The refund owed when a sender cancels a funded booking. Only valid before the
 * document is handed over. After that, problems go through a dispute.
 */
export function senderCancellationRefund(b: Booking, now: Date = new Date()): Refund {
  const untilDeparture = b.departureAt.getTime() - now.getTime();
  switch (b.policy) {
    case "FLEXIBLE":
      return untilDeparture >= DAY_MS
        ? refund(b, 1, "Cancelled 24h or more before departure")
        : refund(b, 0.5, "Cancelled within 24h of departure");
    case "MODERATE":
      return untilDeparture >= 5 * DAY_MS
        ? refund(b, 1, "Cancelled 5 days or more before departure")
        : refund(b, 0.5, "Cancelled within 5 days of departure");
    case "STRICT": {
      const sinceBooking = now.getTime() - b.bookedAt.getTime();
      const bookedEarly = b.departureAt.getTime() - b.bookedAt.getTime() >= 14 * DAY_MS;
      if (bookedEarly && sinceBooking <= 48 * HOUR_MS) {
        return refund(b, 1, "Cancelled within 48h of booking");
      }
      if (untilDeparture >= 7 * DAY_MS) {
        return refund(b, 0.5, "Cancelled 7 days or more before departure");
      }
      return refund(b, 0, "Cancelled within 7 days of departure");
    }
  }
}

/** A traveller cancelling always gives the sender a full refund. */
export function travellerCancellationRefund(b: Booking): Refund {
  return refund(b, 1, "Traveller cancelled");
}
