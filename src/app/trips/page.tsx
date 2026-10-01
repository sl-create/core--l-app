import Link from "next/link";
import { LOCATION_LABELS, LOCATIONS, type Location } from "@/lib/domain/locations";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { levelOf } from "@/lib/domain/levels";
import { formatUtc, LevelBadge, PageHeader, Route } from "@/components/ui";

export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  await requireUser();
  const sp = await searchParams;
  const isLocation = (v: unknown): v is Location => LOCATIONS.includes(v as Location);
  const origin = isLocation(sp.origin) ? sp.origin : undefined;
  const destination = isLocation(sp.destination) ? sp.destination : undefined;

  const trips = await db.trip.findMany({
    where: {
      status: "OPEN",
      departureAt: { gt: new Date() },
      origin,
      destination,
      traveller: { suspendedAt: null },
    },
    include: { traveller: true },
    orderBy: { departureAt: "asc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Upcoming trips"
        subtitle="Travellers flying soon. Post a request to be matched with them."
        action={<Link href="/trips/new" className="btn-primary">Add your trip</Link>}
      />
      <form className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="origin">From</label>
          <select className="input" id="origin" name="origin" defaultValue={origin ?? ""}>
            <option value="">Anywhere</option>
            {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="destination">To</label>
          <select className="input" id="destination" name="destination" defaultValue={destination ?? ""}>
            <option value="">Anywhere</option>
            {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
          </select>
        </div>
        <button className="btn-secondary">Filter</button>
      </form>
      {trips.length === 0 ? (
        <p className="card text-muted">No upcoming trips on this route yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {trips.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Route origin={t.origin} destination={t.destination} />
              <span className="text-sm text-muted">departs {formatUtc(t.departureAt)}</span>
              <span className="ml-auto flex items-center gap-2 text-sm">
                <Link href={`/travellers/${t.traveller.id}`} className="hover:underline">{t.traveller.name}</Link>{" "}
                <LevelBadge level={levelOf(t.traveller)} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
