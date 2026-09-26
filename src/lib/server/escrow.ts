import "server-only";
import type { Booking, Milestone } from "@prisma/client";
import { appUrl, stripe } from "./stripe";

/**
 * Payments use Stripe "separate charges and transfers". The sender's payment
 * lands in Ajo's balance, which acts as escrow, and each confirmed milestone
 * transfers its share to the traveller's Connect account.
 *
 * Without STRIPE_SECRET_KEY every call is simulated and returns fake ids, so
 * the full flow can be tried locally.
 */
export const paymentsSimulated = () => stripe === null;

export async function createCheckout(
  booking: Booking,
  description: string,
): Promise<{ url: string } | { simulatedPaymentIntentId: string }> {
  if (!stripe) return { simulatedPaymentIntentId: `sim_pi_${booking.id}` };
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: booking.currency,
            unit_amount: booking.total,
            product_data: { name: description },
          },
        },
      ],
      metadata: { bookingId: booking.id },
      payment_intent_data: {
        transfer_group: booking.transferGroup,
        metadata: { bookingId: booking.id },
      },
      success_url: `${appUrl()}/bookings/${booking.id}?paid=1`,
      cancel_url: `${appUrl()}/bookings/${booking.id}`,
    },
    { idempotencyKey: `checkout-${booking.id}-${booking.total}` },
  );
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url };
}

async function chargeId(paymentIntentId: string): Promise<string> {
  const pi = await stripe!.paymentIntents.retrieve(paymentIntentId);
  const charge = pi.latest_charge;
  if (!charge) throw new Error(`PaymentIntent ${paymentIntentId} has no charge`);
  return typeof charge === "string" ? charge : charge.id;
}

export async function transferToTraveller(opts: {
  booking: Booking;
  amount: number;
  destinationAccountId: string | null;
  idempotencyKey: string;
}): Promise<string> {
  const { booking, amount } = opts;
  if (!stripe) return `sim_tr_${opts.idempotencyKey}`;
  if (!opts.destinationAccountId) throw new Error("Traveller has no payout account");
  if (!booking.paymentIntentId) throw new Error("Booking has no payment");
  const transfer = await stripe.transfers.create(
    {
      amount,
      currency: booking.currency,
      destination: opts.destinationAccountId,
      transfer_group: booking.transferGroup,
      // Tie the transfer to the charge so it does not wait for the balance to settle.
      source_transaction: await chargeId(booking.paymentIntentId),
      metadata: { bookingId: booking.id },
    },
    { idempotencyKey: opts.idempotencyKey },
  );
  return transfer.id;
}

export async function releaseMilestoneFunds(
  booking: Booking,
  milestone: Milestone,
  destinationAccountId: string | null,
): Promise<string> {
  return transferToTraveller({
    booking,
    amount: milestone.payout,
    destinationAccountId,
    idempotencyKey: `milestone-${milestone.id}`,
  });
}

export async function refundSender(booking: Booking, amount: number): Promise<string | null> {
  if (amount <= 0) return null;
  if (!stripe) return `sim_re_${booking.id}`;
  if (!booking.paymentIntentId) throw new Error("Booking has no payment");
  const refund = await stripe.refunds.create(
    { payment_intent: booking.paymentIntentId, amount, metadata: { bookingId: booking.id } },
    { idempotencyKey: `refund-${booking.id}` },
  );
  return refund.id;
}
