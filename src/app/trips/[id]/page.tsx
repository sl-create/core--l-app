import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelTrip } from "../../actions";
import { CANCELLATION_POLICY_DESCRIPTIONS } from "@/lib/domain/cancellation";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { SEAT_HOLDING } from "@/lib/server/bookings";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { ErrorBanner, Field, formatUtc, Money, PageHeader, Route, StatusBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { RequestFeed } from "@/components/request-feed";

export default async function TripPage({ params, searchParams }: PageProps<"/trips/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const trip = await db.trip.findUnique({
    where: { id },
    include: {
      bookings: { orderBy: { proposedAt: "desc" }, include: { request: { include: { sender: true } } } },
    },
  });
  if (!trip || trip.travellerId !== user.id) notFound();
  const seatsTaken = trip.bookings.filter((b) => SEAT_HOLDING.includes(b.status)).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title={<Route origin={trip.origin} destination={trip.destination} />}
        subtitle={`Departs ${formatUtc(trip.departureAt)}`}
        action={<StatusBadge status={trip.status} />}
      />
      <ErrorBanner message={error} />
      <section className="card">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label="Departure">{formatUtc(trip.departureAt)}</Field>
          <Field label="Arrival">{formatUtc(trip.arrivalAt)}</Field>
          <Field label="Capacity">{seatsTaken} of {trip.capacity} booked</Field>
          <Field label="Cancellation policy">
            <span className="font-medium">{trip.cancellationPolicy.charAt(0) + trip.cancellationPolicy.slice(1).toLowerCase()}</span>
            <span className="block text-sm text-muted">{CANCELLATION_POLICY_DESCRIPTIONS[trip.cancellationPolicy]}</span>
          </Field>
          {trip.notes && <Field label="Notes">{trip.notes}</Field>}
        </dl>
        {trip.status === "OPEN" && (
          <form action={cancelTrip.bind(null, trip.id)} className="mt-5">
            <SubmitButton variant="danger" confirm="Cancel this trip? Pending booking requests will be cancelled.">
              Cancel trip
            </SubmitButton>
          </form>
        )}
      </section>

      {trip.status === "OPEN" && trip.departureAt > new Date() && seatsTaken < trip.capacity && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">Requests you could carry</h2>
          <p className="mb-3 text-sm text-muted">Documents on your route that fit your dates. Offer to carry one and the sender decides.</p>
          <RequestFeed trip={trip} traveller={user} seatsLeft={trip.capacity - seatsTaken} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Bookings</h2>
        {trip.bookings.length === 0 ? (
          <p className="card text-muted">No booking requests yet. Senders on this route will see your trip.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {trip.bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-background">
                  <span className="font-medium">{DOCUMENT_LABELS[b.request.documentType]}</span>
                  <span className="text-sm text-muted">from {b.request.sender.name}</span>
                  <span className="text-sm">you earn <Money amount={b.travellerPayout} currency={b.currency} /></span>
                  <span className="ml-auto"><StatusBadge status={b.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
