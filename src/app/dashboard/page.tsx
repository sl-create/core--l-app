import Link from "next/link";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { db } from "@/lib/server/db";
import { unreadCounts } from "@/lib/server/messages";
import { requireUser } from "@/lib/server/session";
import { formatUtc, PageHeader, Route, StatusBadge } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireUser();
  const [requests, trips, toAccept, toPay, toConfirm, unread] = await Promise.all([
    db.deliveryRequest.findMany({
      where: { senderId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.trip.findMany({
      where: { travellerId: user.id },
      orderBy: { departureAt: "desc" },
      include: { _count: { select: { bookings: { where: { status: "PROPOSED" } } } } },
      take: 20,
    }),
    db.booking.count({ where: { status: "PROPOSED", trip: { travellerId: user.id } } }),
    db.booking.findMany({
      where: { status: "ACCEPTED", request: { senderId: user.id } },
      select: { id: true },
    }),
    db.milestone.findMany({
      where: { status: "CLAIMED", booking: { request: { senderId: user.id } } },
      select: { bookingId: true },
    }),
    unreadCounts(user.id),
  ]);

  const actions = [
    ...[...unread].map(([bookingId, n]) => ({
      href: `/bookings/${bookingId}`,
      text: `${n} unread message${n > 1 ? "s" : ""} on a booking.`,
    })),
    ...toPay.map((b) => ({ href: `/bookings/${b.id}`, text: "A traveller accepted your booking. Pay to confirm it." })),
    ...toConfirm.map((m) => ({ href: `/bookings/${m.bookingId}`, text: "A milestone is waiting for your confirmation." })),
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Welcome, ${user.name.split(" ")[0]}`}
        action={
          <div className="flex gap-2">
            <Link href="/requests/new" className="btn-primary">Send a document</Link>
            <Link href="/trips/new" className="btn-secondary">Add a trip</Link>
          </div>
        }
      />

      {(actions.length > 0 || toAccept > 0) && (
        <section className="card border-accent/40">
          <h2 className="mb-3 font-semibold">Needs your attention</h2>
          <ul className="space-y-2 text-sm">
            {toAccept > 0 && (
              <li>
                You have {toAccept} booking request{toAccept > 1 && "s"} on your trips. Open a trip
                below to respond.
              </li>
            )}
            {actions.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="link">{a.text}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your requests</h2>
        {requests.length === 0 ? (
          <p className="text-muted">No requests yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {requests.map((r) => (
              <li key={r.id}>
                <Link href={`/requests/${r.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-background">
                  <span className="font-medium">{DOCUMENT_LABELS[r.documentType]}</span>
                  <Route origin={r.origin} destination={r.destination} />
                  <span className="text-sm text-muted">by {formatUtc(r.deadline)}</span>
                  <span className="ml-auto"><StatusBadge status={r.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your trips</h2>
        {trips.length === 0 ? (
          <p className="text-muted">No trips yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {trips.map((t) => (
              <li key={t.id}>
                <Link href={`/trips/${t.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-background">
                  <Route origin={t.origin} destination={t.destination} />
                  <span className="text-sm text-muted">departs {formatUtc(t.departureAt)}</span>
                  {t._count.bookings > 0 && (
                    <span className="text-sm font-medium text-accent">
                      {t._count.bookings} new request{t._count.bookings > 1 && "s"}
                    </span>
                  )}
                  <span className="ml-auto"><StatusBadge status={t.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
