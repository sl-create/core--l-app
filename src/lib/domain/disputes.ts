/** Mirrors the Prisma DisputeOutcome enum. */
export const DISPUTE_OUTCOMES = ["RELEASED_TO_TRAVELLER", "REFUNDED_TO_SENDER", "SPLIT"] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

/** Reads an amount typed by an admin ("12", "12.5", "£12.50") into minor units. */
export function parseMoneyInput(input: string): number | null {
  const cleaned = input.trim().replace(/^[£$]/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export type Split =
  | { ok: true; toTraveller: number; toSender: number }
  | { ok: false; error: string };

/**
 * Divides what is still in escrow between the two parties when a dispute ends the booking.
 * The traveller gets part of their unreleased payout; the sender gets the rest of it, plus
 * the service fee if Ajo chooses to refund it. Money already released stays released.
 */
export function splitEscrow(opts: {
  unreleasedPayout: number;
  serviceFee: number;
  toTraveller: number;
  refundServiceFee: boolean;
}): Split {
  const { unreleasedPayout, serviceFee, toTraveller, refundServiceFee } = opts;
  if (!Number.isInteger(toTraveller) || toTraveller <= 0) {
    return { ok: false, error: "Enter an amount for the traveller above zero. To pay them nothing, refund the sender instead." };
  }
  if (toTraveller > unreleasedPayout) {
    return { ok: false, error: "The traveller can get at most what is still held for them in escrow." };
  }
  return {
    ok: true,
    toTraveller,
    toSender: unreleasedPayout - toTraveller + (refundServiceFee ? serviceFee : 0),
  };
}
