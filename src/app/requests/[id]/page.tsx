import Link from "next/link";
import { notFound } from "next/navigation";
import { acceptBooking, cancelRequest, declineBooking, proposeBooking } from "../../actions";
import { CANCELLATION_POLICY_DESCRIPTIONS } from "@/lib/domain/cancellation";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { averageRating, LEVEL_INFO, levelOf } from "@/lib/domain/levels";
import { rankMatches } from "@/lib/domain/matching";
import { quote } from "@/lib/domain/pricing";
import { SEAT_HOLDING } from "@/lib/server/bookings";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import {
  ErrorBanner,
  Field,
  formatUtc,
  LevelBadge,
  Money,
  PageHeader,
  Route,
  StatusBadge,
  Stars,
} from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type Traveller = Parameters<typeof levelOf>[0] & {
  id: string;
  name: string;
  completedDeliveries: number;
};

function TravellerSummary({ traveller }: { traveller: Traveller }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/travellers/${traveller.id}`} className="font-semibold hover:underline">
        {traveller.name}
      </Link>
      <LevelBadge level={levelOf(traveller)} />
      <Stars value={averageRating(traveller)} count={traveller.ratingCount} />
      <span className="text-xs text-muted">{traveller.completedDeliveries} deliveries</span>
    </div>
  );
}

async function findMatches(request: NonNullable<Awaited<ReturnType<typeof loadRequest>>>, exclude: string[]) {
  const trips = await db.trip.findMany({
    where: {
      status: "OPEN",
      origin: request.origin,
      destination: request.destination,
      departureAt: { gt: new Date() },
      arrivalAt: { lte: request.deadline },
      travellerId: { not: request.senderId },
      traveller: { suspendedAt: null },
      id: { notIn: exclude },
    },
    include: { traveller: true },
    take: 50,
  });
  const taken = await db.booking.groupBy({
    by: ["tripId"],
    where: { tripId: { in: trips.map((t) => t.id) }, status: { in: SEAT_HOLDING } },
    _count: true,
  });
  const takenByTrip = new Map(taken.map((t) => [t.tripId, t._count]));
  return rankMatches(
    request,
    trips.map((t) => ({
      ...t,
      capacityRemaining: t.capacity - (takenByTrip.get(t.id) ?? 0),
      travellerLevel: levelOf(t.traveller),
    })),
  );
}

function loadRequest(id: string) {
  return db.deliveryRequest.findUnique({
    where: { id },
    include: {
      bookings: { orderBy: { proposedAt: "desc" }, include: { trip: { include: { traveller: true } } } },
    },
  });
}

export default async function RequestPage({ params, searchParams }: PageProps<"/requests/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const request = await loadRequest(id);
  if (!request || request.senderId !== user.id) notFound();

  const offers = request.bookings.filter((b) => b.status === "PROPOSED" && b.proposedBy === "TRAVELLER");
  const others = request.bookings.filter((b) => !offers.includes(b));
  const booked = request.bookings.some((b) => ["ACCEPTED", "FUNDED", "DISPUTED", "COMPLETED"].includes(b.status));
  const pendingAsk = request.bookings.find((b) => b.status === "PROPOSED" && b.proposedBy === "SENDER");
  const canPropose = request.status === "OPEN" && !booked && !pendingAsk;
  const matches = canPropose ? await findMatches(request, offers.map((o) => o.tripId)) : [];
  const q = quote(request);

  return (
    <div className="space-y-8">
      <PageHeader
        title={DOCUMENT_LABELS[request.documentType]}
        subtitle={<Route origin={request.origin} destination={request.destination} />}
        action={<StatusBadge status={request.status} />}
      />
      <ErrorBanner message={error} />

      <section className="card">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label="Ready from">{formatUtc(request.availableFrom)}</Field>
          <Field label="Deadline">{formatUtc(request.deadline)}</Field>
          <Field label="Pickup area">{request.pickupCity}</Field>
          <Field label="Recipient">{request.recipientName} · {request.recipientPhone}</Field>
          <Field label="Who can carry it">
            {request.minLevel === "ARINRIN_AJO" ? (
              "Any verified traveller"
            ) : (
              <><LevelBadge level={request.minLevel} /> <span className="text-sm text-muted">and above</span></>
            )}
          </Field>
          {request.description && <Field label="Details">{request.description}</Field>}
        </dl>
        {request.status === "OPEN" && (
          <form action={cancelRequest.bind(null, request.id)} className="mt-5">
            <SubmitButton variant="danger" confirm="Cancel this request?">Cancel request</SubmitButton>
          </form>
        )}
      </section>

      {offers.length > 0 && request.status === "OPEN" && !booked && (
        <section>
          <h2 className="mb-1 text-lg font-semibold">
            Travellers offering to carry this <span className="text-muted">({offers.length})</span>
          </h2>
          <p className="mb-3 text-sm text-muted">Accept one and the others are closed automatically.</p>
          <ul className="space-y-3">
            {offers.map((b) => (
              <li key={b.id} className="card flex flex-wrap items-center gap-4 border-brand/40">
                <div className="min-w-0 flex-1">
                  <TravellerSummary traveller={b.trip.traveller} />
                  <p className="mt-1 text-sm text-muted">
                    Departs {formatUtc(b.trip.departureAt)} · lands {formatUtc(b.trip.arrivalAt)}
                  </p>
                  <p className="mt-1 text-sm">
                    <Money amount={b.total} currency={b.currency} /> total ·{" "}
                    <Link href={`/bookings/${b.id}`} className="link">Message {b.trip.traveller.name.split(" ")[0]}</Link>
                  </p>
                </div>
                <form action={acceptBooking.bind(null, b.id)}><SubmitButton>Accept offer</SubmitButton></form>
                <form action={declineBooking.bind(null, b.id)}><SubmitButton variant="secondary">Decline</SubmitButton></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Bookings</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {others.map((b) => (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-background">
                  <span className="font-medium">{b.trip.traveller.name}</span>
                  <span className="text-sm text-muted">departs {formatUtc(b.trip.departureAt)}</span>
                  <Money amount={b.total} currency={b.currency} />
                  <span className="ml-auto"><StatusBadge status={b.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canPropose && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Matching trips</h2>
            <p className="text-sm text-muted">
              Price right now: <Money amount={q.total} currency={q.currency} /> ({q.urgency.toLowerCase()} urgency,
              including <Money amount={q.serviceFee} currency={q.currency} /> Ajo fee)
            </p>
          </div>
          {matches.length === 0 ? (
            <p className="card text-muted">
              No trips match yet. Travellers on this route can also see your request and offer to carry it.
            </p>
          ) : (
            <ul className="space-y-3">
              {matches.map((t) => (
                <li key={t.id} className="card flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <TravellerSummary traveller={t.traveller} />
                    <p className="mt-1 text-sm text-muted">
                      Departs {formatUtc(t.departureAt)} · lands {formatUtc(t.arrivalAt)}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {t.cancellationPolicy.charAt(0) + t.cancellationPolicy.slice(1).toLowerCase()} cancellation:{" "}
                      {CANCELLATION_POLICY_DESCRIPTIONS[t.cancellationPolicy]}
                    </p>
                  </div>
                  <form action={proposeBooking.bind(null, request.id, t.id)}>
                    <SubmitButton>Request this traveller</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="hint mt-3">
            Travellers are ordered by level, then by earliest arrival.{" "}
            {request.minLevel !== "ARINRIN_AJO" && `Only ${LEVEL_INFO[request.minLevel].name} and above are shown.`}
          </p>
        </section>
      )}
    </div>
  );
}
