import Link from "next/link";
import { notFound } from "next/navigation";
import {
  acceptBooking,
  cancelBooking,
  claimMilestone,
  confirmMilestone,
  declineBooking,
  disputeMilestone,
  payBooking,
} from "../../actions";
import {
  CANCELLATION_POLICY_DESCRIPTIONS,
  senderCancellationRefund,
} from "@/lib/domain/cancellation";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { MILESTONE_LABELS } from "@/lib/domain/milestones";
import { db } from "@/lib/server/db";
import { paymentsSimulated } from "@/lib/server/escrow";
import { requireUser } from "@/lib/server/session";
import {
  ErrorBanner,
  formatUtc,
  Money,
  PageHeader,
  Route,
  StatusBadge,
  TrustBadge,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function BookingPage({ params, searchParams }: PageProps<"/bookings/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { error, paid } = await searchParams;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      request: { include: { sender: true } },
      trip: { include: { traveller: true } },
      milestones: { orderBy: { sequence: "asc" } },
    },
  });
  if (!booking) notFound();
  const { request, trip } = booking;
  const isSender = request.senderId === user.id;
  const isTraveller = trip.travellerId === user.id;
  if (!isSender && !isTraveller) notFound();

  const money = (amount: number) => <Money amount={amount} currency={booking.currency} />;
  const pickedUp = booking.milestones.some((m) => m.type === "PICKED_UP" && m.status !== "PENDING");
  const canCancel =
    ["PROPOSED", "ACCEPTED"].includes(booking.status) || (booking.status === "FUNDED" && !pickedUp);
  const refundPreview =
    isSender && booking.status === "FUNDED"
      ? senderCancellationRefund({
          policy: booking.cancellationPolicy,
          travellerPayout: booking.travellerPayout,
          serviceFee: booking.serviceFee,
          bookedAt: booking.fundedAt ?? booking.proposedAt,
          departureAt: trip.departureAt,
        })
      : null;
  const firstPending = booking.milestones.find((m) => m.status === "PENDING");
  const inProgress = ["FUNDED", "COMPLETED", "DISPUTED"].includes(booking.status);

  return (
    <div className="space-y-8">
      <PageHeader
        title={DOCUMENT_LABELS[request.documentType]}
        subtitle={<Route origin={request.origin} destination={request.destination} />}
        action={<StatusBadge status={booking.status} />}
      />
      <ErrorBanner message={error} />
      {paid && booking.status === "ACCEPTED" && (
        <p className="card text-sm">Payment received. Confirming with Stripe; refresh in a moment.</p>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">{isSender ? "Your traveller" : "Your sender"}</h2>
          {isSender ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{trip.traveller.name}</span>
                <TrustBadge tier={trip.traveller.trustTier} />
              </div>
              <p className="text-sm text-muted">{trip.traveller.completedDeliveries} completed deliveries</p>
              <p className="text-sm text-muted">
                Departs {formatUtc(trip.departureAt)}, lands {formatUtc(trip.arrivalAt)}
              </p>
              {inProgress && <p className="text-sm">Contact: {trip.traveller.email}</p>}
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-medium">{request.sender.name}</p>
              <p className="text-sm text-muted">Pickup area: {request.pickupCity}</p>
              <p className="text-sm text-muted">
                Ready from {formatUtc(request.availableFrom)} · deliver by {formatUtc(request.deadline)}
              </p>
              {inProgress ? (
                <>
                  <p className="text-sm">Contact: {request.sender.email}</p>
                  <p className="text-sm">
                    Deliver to {request.recipientName}, {request.recipientPhone}
                  </p>
                </>
              ) : (
                <p className="hint">Contact and recipient details appear once the booking is paid.</p>
              )}
              {request.description && <p className="text-sm">&ldquo;{request.description}&rdquo;</p>}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-semibold">Price</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt>Traveller fee ({booking.urgency.toLowerCase()})</dt><dd>{money(booking.travellerPayout)}</dd></div>
            {isSender && (
              <>
                <div className="flex justify-between"><dt>Ajo service fee</dt><dd>{money(booking.serviceFee)}</dd></div>
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Total</dt><dd>{money(booking.total)}</dd></div>
              </>
            )}
            {booking.refundedAmount > 0 && (
              <div className="flex justify-between text-muted"><dt>Refunded</dt><dd>{money(booking.refundedAmount)}</dd></div>
            )}
          </dl>
          <p className="hint mt-3">
            {booking.cancellationPolicy.charAt(0) + booking.cancellationPolicy.slice(1).toLowerCase()} policy:{" "}
            {CANCELLATION_POLICY_DESCRIPTIONS[booking.cancellationPolicy]}
          </p>
        </div>
      </section>

      {booking.status === "PROPOSED" && (
        <section className="card flex flex-wrap items-center gap-3">
          {isTraveller ? (
            <>
              <p className="flex-1 text-sm">
                {request.sender.name} wants you to carry this document. You&apos;ll earn {money(booking.travellerPayout)}.
              </p>
              <form action={acceptBooking.bind(null, booking.id)}><SubmitButton>Accept</SubmitButton></form>
              <form action={declineBooking.bind(null, booking.id)}><SubmitButton variant="secondary">Decline</SubmitButton></form>
            </>
          ) : (
            <p className="text-sm text-muted">Waiting for {trip.traveller.name} to respond.</p>
          )}
        </section>
      )}

      {booking.status === "ACCEPTED" && (
        <section className="card flex flex-wrap items-center gap-3">
          {isSender ? (
            <>
              <p className="flex-1 text-sm">
                {trip.traveller.name} accepted. Pay {money(booking.total)} into escrow to confirm. The
                traveller is paid step by step as you confirm each milestone.
                {paymentsSimulated() && <span className="block text-xs text-muted">Test mode: payment is simulated.</span>}
              </p>
              <form action={payBooking.bind(null, booking.id)}><SubmitButton>Pay {money(booking.total)}</SubmitButton></form>
            </>
          ) : (
            <p className="text-sm text-muted">Accepted. Waiting for {request.sender.name} to pay.</p>
          )}
        </section>
      )}

      {booking.milestones.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Journey</h2>
          <ol className="space-y-3">
            {booking.milestones.map((m) => (
              <li key={m.id} className="card">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-strong">
                    {m.sequence + 1}
                  </span>
                  <span className="font-medium">{MILESTONE_LABELS[m.type]}</span>
                  <span className="text-sm text-muted">releases {money(m.payout)}</span>
                  <span className="ml-auto"><StatusBadge status={m.status} /></span>
                </div>
                {m.note && <p className="mt-2 text-sm text-muted">&ldquo;{m.note}&rdquo;</p>}
                {m.status === "CLAIMED" && m.claimExpiresAt && (
                  <p className="mt-2 text-sm">
                    Claimed {formatUtc(m.claimedAt!)}. Confirms automatically at{" "}
                    <strong>{formatUtc(m.claimExpiresAt)}</strong> unless disputed.
                  </p>
                )}
                {m.status === "CONFIRMED" && m.confirmedAt && (
                  <p className="mt-2 text-sm text-muted">
                    Confirmed {formatUtc(m.confirmedAt)}{m.transferId ? " · paid out" : " · payout pending"}
                  </p>
                )}

                {isTraveller && booking.status === "FUNDED" && m.id === firstPending?.id && (
                  <form action={claimMilestone.bind(null, booking.id, m.id)} className="mt-3 flex flex-wrap gap-2">
                    <input className="input flex-1" name="note" placeholder="Optional note, e.g. flight number or where you met" />
                    <SubmitButton>Mark as done</SubmitButton>
                  </form>
                )}

                {isSender && m.status === "CLAIMED" && booking.status === "FUNDED" && (
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <form action={confirmMilestone.bind(null, booking.id, m.id)}>
                      <SubmitButton>Confirm and release {money(m.payout)}</SubmitButton>
                    </form>
                    <details className="flex-1">
                      <summary className="btn-danger cursor-pointer list-none">Something&apos;s wrong</summary>
                      <form action={disputeMilestone.bind(null, booking.id, m.id)} className="mt-2 space-y-2">
                        <textarea className="input" name="note" rows={2} required placeholder="What happened?" />
                        <SubmitButton variant="danger">Open dispute</SubmitButton>
                      </form>
                    </details>
                  </div>
                )}
              </li>
            ))}
          </ol>
          {booking.status === "DISPUTED" && (
            <p className="mt-3 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
              This booking is under review. Funds stay in escrow until the Ajo team resolves the dispute.
            </p>
          )}
        </section>
      )}

      {canCancel && (
        <section className="card">
          <h2 className="mb-2 font-semibold">Cancel booking</h2>
          {refundPreview ? (
            <p className="mb-3 text-sm text-muted">
              If you cancel now you get {money(refundPreview.total)} back ({refundPreview.reason.toLowerCase()}).
            </p>
          ) : isTraveller && booking.status === "FUNDED" ? (
            <p className="mb-3 text-sm text-muted">
              If you cancel, the sender gets a full refund.
            </p>
          ) : null}
          <form action={cancelBooking.bind(null, booking.id)}>
            <SubmitButton variant="danger" confirm="Cancel this booking?">Cancel booking</SubmitButton>
          </form>
        </section>
      )}

      <p className="text-sm">
        <Link href={isSender ? `/requests/${request.id}` : `/trips/${trip.id}`} className="link">
          ← Back to {isSender ? "request" : "trip"}
        </Link>
      </p>
    </div>
  );
}
