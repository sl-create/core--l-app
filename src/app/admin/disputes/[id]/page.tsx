import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveDispute } from "../../actions";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { MILESTONE_LABELS, unreleasedPayout } from "@/lib/domain/milestones";
import { requireAdmin } from "@/lib/server/admin";
import { listMessages, MAX_MESSAGE_LENGTH } from "@/lib/server/messages";
import { MessageThread } from "@/components/message-thread";
import { db } from "@/lib/server/db";
import { levelOf } from "@/lib/domain/levels";
import { ErrorBanner, Field, formatAt, LocalTime, LevelBadge, Money, PageHeader, Route, StatusBadge, TrustBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ResolveOptions } from "@/components/resolve-options";

export default async function DisputePage({ params, searchParams }: PageProps<"/admin/disputes/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const dispute = await db.dispute.findUnique({
    where: { id },
    include: {
      milestone: true,
      resolvedBy: true,
      booking: {
        include: {
          request: { include: { sender: true } },
          trip: { include: { traveller: true } },
          milestones: { orderBy: { sequence: "asc" } },
        },
      },
    },
  });
  if (!dispute) notFound();
  const me = await requireAdmin();
  const messages = await listMessages(dispute.bookingId);
  const { booking } = dispute;
  const { request, trip } = booking;
  const money = (n: number) => <Money amount={n} currency={booking.currency} />;
  // Admins who are part of the booking can talk in it, but not decide it.
  const myRole = request.senderId === me.id ? "sender" : trip.travellerId === me.id ? "traveller" : null;
  const party = (u: typeof request.sender, role: string) => (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-muted">{role}</p>
      <Link href={`/admin/users/${u.id}`} className="link">{u.name}</Link>
      <p className="text-sm text-muted">{u.email}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <TrustBadge tier={u.trustTier} />
        {levelOf(u) && <LevelBadge level={levelOf(u)} />}
        <span className="text-muted">{u.completedDeliveries} deliveries · {u.upheldDisputes} upheld disputes</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dispute: ${MILESTONE_LABELS[dispute.milestone.type]}`}
        subtitle={
          <>
            {DOCUMENT_LABELS[request.documentType]} · <Route origin={request.origin} destination={request.destination} />
          </>
        }
        action={<StatusBadge status={dispute.status} tone={dispute.status === "OPEN" ? "red" : "gray"} />}
      />
      <ErrorBanner message={error} />

      <section className="card border-danger/40">
        <p className="text-xs uppercase tracking-wide text-muted">Sender&apos;s complaint · <LocalTime date={dispute.createdAt} /></p>
        <p className="mt-1 whitespace-pre-wrap">{dispute.reason}</p>
        {dispute.milestone.note && (
          <>
            <p className="mt-4 text-xs uppercase tracking-wide text-muted">Traveller&apos;s claim note</p>
            <p className="mt-1">{dispute.milestone.note}</p>
          </>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        {party(request.sender, "Sender")}
        {party(trip.traveller, "Traveller")}
      </div>

      <section className="card">
        <h2 className="mb-3 font-semibold">Booking</h2>
        <dl className="mb-4 grid gap-4 sm:grid-cols-4">
          <Field label="Status"><StatusBadge status={booking.status} /></Field>
          <Field label="Paid">{money(booking.total)}</Field>
          <Field label="Flight">{formatAt(trip.departureAt, trip.origin)}</Field>
          <Field label="Deadline">{formatAt(request.deadline, request.destination)}</Field>
        </dl>
        <ul className="space-y-2 text-sm">
          {booking.milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3">
              <StatusBadge status={m.status} />
              <span>{MILESTONE_LABELS[m.type]}</span>
              <span className="text-muted">{money(m.payout)}</span>
              {m.claimedAt && <span className="text-muted">claimed <LocalTime date={m.claimedAt} /></span>}
              {m.transferId && <span className="text-muted">paid out</span>}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          <Link href={`/bookings/${booking.id}`} className="link">Open booking page →</Link>
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Conversation</h2>
        <MessageThread
          bookingId={dispute.bookingId}
          userId={me.id}
          initial={messages}
          canPost
          maxLength={MAX_MESSAGE_LENGTH}
        />
        <p className="hint">
          {myRole
            ? `You're the ${myRole} on this booking, so your messages appear under your own name.`
            : "Your messages appear to both parties as Ajo support."}
        </p>
      </section>

      {dispute.status === "OPEN" && myRole ? (
        <section className="card">
          <h2 className="mb-2 font-semibold">Resolve</h2>
          <p className="text-sm text-muted">
            You&apos;re the {myRole} on this booking, so another admin needs to resolve this dispute.
          </p>
        </section>
      ) : dispute.status === "OPEN" ? (
        <form action={resolveDispute.bind(null, dispute.id)} className="card space-y-4">
          <h2 className="font-semibold">Resolve</h2>
          <ResolveOptions
            currency={booking.currency}
            travellerName={trip.traveller.name}
            senderName={request.sender.name}
            milestonePayout={dispute.milestone.payout}
            unreleasedPayout={unreleasedPayout(booking.milestones)}
            serviceFee={booking.serviceFee}
          />
          <div>
            <label className="label" htmlFor="note">Resolution note (shared with both parties)</label>
            <textarea className="input" id="note" name="note" rows={3} required />
          </div>
          <SubmitButton confirm="Resolve this dispute? Money will move immediately.">Resolve dispute</SubmitButton>
        </form>
      ) : (
        <section className="card">
          <h2 className="mb-2 font-semibold">Resolution</h2>
          <p className="text-sm">
            {dispute.outcome === "RELEASED_TO_TRAVELLER" ? (
              "Released to traveller"
            ) : dispute.outcome === "SPLIT" ? (
              <>
                Split: {money(dispute.travellerAmount ?? 0)} to traveller
                {dispute.transferId ? "" : " (payout pending)"}, {money(dispute.refundAmount ?? 0)} refunded to sender
              </>
            ) : (
              <>Refunded {money(dispute.refundAmount ?? 0)} to sender</>
            )}{" "}
            by {dispute.resolvedBy?.name} on {dispute.resolvedAt && <LocalTime date={dispute.resolvedAt} />}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{dispute.resolutionNote}</p>
        </section>
      )}
    </div>
  );
}
