import type Stripe from "stripe";
import { markIdentityVerified } from "@/lib/server/accounts";
import { markFunded } from "@/lib/server/bookings";
import { stripe } from "@/lib/server/stripe";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return new Response("Stripe is not configured", { status: 501 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      req.headers.get("stripe-signature") ?? "",
      secret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const bookingId = session.metadata?.bookingId;
      const pi = session.payment_intent;
      if (bookingId && pi && session.payment_status === "paid") {
        const paymentIntentId = typeof pi === "string" ? pi : pi.id;
        if (!(await markFunded(bookingId, paymentIntentId))) {
          await stripe.refunds.create(
            { payment_intent: paymentIntentId, metadata: { bookingId, reason: "booking_not_payable" } },
            { idempotencyKey: `orphan-refund-${paymentIntentId}` },
          );
        }
      }
      break;
    }
    case "identity.verification_session.verified": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) await markIdentityVerified(userId, session.id);
      break;
    }
  }
  return Response.json({ received: true });
}
