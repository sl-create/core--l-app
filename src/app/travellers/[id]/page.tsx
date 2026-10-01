import { notFound } from "next/navigation";
import { averageRating, LEVEL_INFO, levelOf } from "@/lib/domain/levels";
import { db } from "@/lib/server/db";
import { requireUser } from "@/lib/server/session";
import { formatUtc, LevelBadge, Route } from "@/components/ui";

export default async function TravellerProfile({ params }: PageProps<"/travellers/[id]">) {
  await requireUser();
  const { id } = await params;
  const traveller = await db.user.findUnique({ where: { id } });
  if (!traveller || traveller.suspendedAt) notFound();
  const [reviews, trips] = await Promise.all([
    db.rating.findMany({
      where: { travellerId: id },
      include: { rater: { select: { name: true } }, booking: { select: { request: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.trip.findMany({
      where: { travellerId: id, status: "OPEN", departureAt: { gt: new Date() } },
      orderBy: { departureAt: "asc" },
      take: 5,
    }),
  ]);
  const level = levelOf(traveller);
  const avg = averageRating(traveller);
  const onTime = traveller.completedDeliveries
    ? `${Math.round((traveller.onTimeDeliveries / traveller.completedDeliveries) * 100)}%`
    : "–";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-2xl font-bold text-brand-strong">
          {traveller.name.slice(0, 1)}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{traveller.name}</h1>
        <div className="mt-2 flex justify-center"><LevelBadge level={level} showMeaning /></div>
        {level && <p className="mt-2 text-sm text-muted">{LEVEL_INFO[level].blurb}</p>}
        <dl className="mt-5 grid grid-cols-3 gap-3">
          <div><dt className="text-xs text-muted">Deliveries</dt><dd className="text-xl font-bold">{traveller.completedDeliveries}</dd></div>
          <div><dt className="text-xs text-muted">Rating</dt><dd className="text-xl font-bold">{avg === null ? "–" : `${avg.toFixed(1)}★`}</dd></div>
          <div><dt className="text-xs text-muted">On time</dt><dd className="text-xl font-bold">{onTime}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-muted">Member since {formatUtc(traveller.createdAt).split(",").slice(0, 2).join(",")}</p>
      </section>

      {trips.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold">Upcoming trips</h2>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
            {trips.map((t) => (
              <li key={t.id} className="flex flex-wrap gap-3 px-5 py-3">
                <Route origin={t.origin} destination={t.destination} />
                <span className="text-muted">departs {formatUtc(t.departureAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted">No reviews yet.</p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="card">
                <div className="flex items-center justify-between">
                  <span className="text-amber-500" aria-label={`${r.score} stars`}>
                    {"★".repeat(r.score)}<span className="text-border">{"★".repeat(5 - r.score)}</span>
                  </span>
                  <span className="text-xs text-muted">{formatUtc(r.createdAt)}</span>
                </div>
                {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
                <p className="mt-2 text-xs text-muted">
                  {r.rater.name} · <Route origin={r.booking.request.origin} destination={r.booking.request.destination} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
