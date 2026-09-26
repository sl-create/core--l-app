import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveDispute } from "../../actions";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { MILESTONE_LABELS } from "@/lib/domain/milestones";
import { refundableAmount } from "@/lib/server/admin";
import { db } from "@/lib/server/db";
import { ErrorBanner, Field, formatUtc, Money, PageHeader, Route, StatusBadge, TrustBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

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
  const { booking } = dispute;
  const { request, trip } = booking;
  const money = (n: number) => <Money amount={n} currency={booking.currency} />;
  const party = (u: typeof request.sender, role: string) => (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-muted">{role}</p>
      <Link href={`/admin/users/${u.id}`} className="link">{u.name}</Link>
      <p className="text-sm text-muted">{u.email}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <TrustBadge tier={u.trustTier} />
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
        <p className="text-xs uppercase tracking-wide text-muted">Sender&apos;s complaint · {formatUtc(dispute.createdAt)}</p>
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
          <Field label="Flight">{formatUtc(trip.departureAt)}</Field>
          <Field label="Deadline">{formatUtc(request.deadline)}</Field>
        </dl>
        <ul className="space-y-2 text-sm">
          {booking.milestones.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3">
              <StatusBadge status={m.status} />
              <span>{MILESTONE_LABELS[m.type]}</span>
              <span className="text-muted">{money(m.payout)}</span>
              {m.claimedAt && <span className="text-muted">claimed {formatUtc(m.claimedAt)}</span>}
              {m.transferId && <span className="text-muted">paid out</span>}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm">
          <Link href={`/bookings/${booking.id}`} className="link">Open booking page →</Link>
        </p>
      </section>

      {dispute.status === "OPEN" ? (
        <form action={resolveDispute.bind(null, dispute.id)} className="card space-y-4">
          <h2 className="font-semibold">Resolve</h2>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[:checked]:border-brand">
            <input type="radio" name="outcome" value="release" defaultChecked className="mt-1" />
            <span>
              <span className="font-medium">Release to traveller</span>
              <span className="block text-sm text-muted">
                The claim stands. Pay {money(dispute.milestone.payout)} and resume the journey.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[:checked]:border-danger">
            <input type="radio" name="outcome" value="refund" className="mt-1" />
            <span>
              <span className="font-medium">Refund sender and end booking</span>
              <span className="block text-sm text-muted">
                Refunds {money(refundableAmount(booking, false))} still in escrow
                ({money(refundableAmount(booking, true))} with the service fee). Counts as an upheld
                dispute against the traveller.
              </span>
              <span className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" name="includeServiceFee" defaultChecked /> Also refund the Ajo service fee
              </span>
            </span>
          </label>
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
            {dispute.outcome === "RELEASED_TO_TRAVELLER"
              ? "Released to traveller"
              : <>Refunded {money(dispute.refundAmount ?? 0)} to sender</>}{" "}
            by {dispute.resolvedBy?.name} on {dispute.resolvedAt && formatUtc(dispute.resolvedAt)}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{dispute.resolutionNote}</p>
        </section>
      )}
    </div>
  );
}
