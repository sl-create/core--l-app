import Link from "next/link";
import { db } from "@/lib/server/db";
import { Money, PageHeader } from "@/components/ui";
import { unreleasedPayout } from "@/lib/domain/milestones";
import { TRUST_TIER_LABELS, TRUST_TIERS } from "@/lib/domain/trust";

export default async function AdminOverview() {
  const [openDisputes, funded, tiers, suspended] = await Promise.all([
    db.dispute.count({ where: { status: "OPEN" } }),
    db.booking.findMany({
      where: { status: { in: ["FUNDED", "DISPUTED"] } },
      select: { currency: true, milestones: { select: { status: true, payout: true } } },
    }),
    db.user.groupBy({ by: ["trustTier"], _count: true }),
    db.user.count({ where: { suspendedAt: { not: null } } }),
  ]);

  // Money still sitting in escrow: unreleased traveller payouts. Service fees are Ajo's revenue.
  const held = new Map<string, number>();
  for (const b of funded) {
    held.set(b.currency, (held.get(b.currency) ?? 0) + unreleasedPayout(b.milestones));
  }
  const tierCount = new Map(tiers.map((t) => [t.trustTier, t._count]));

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/admin/disputes" className="card hover:border-brand">
          <p className="text-sm text-muted">Open disputes</p>
          <p className={`mt-1 text-3xl font-bold ${openDisputes ? "text-danger" : ""}`}>{openDisputes}</p>
        </Link>
        <div className="card">
          <p className="text-sm text-muted">Bookings in progress</p>
          <p className="mt-1 text-3xl font-bold">{funded.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-muted">Held in escrow</p>
          <p className="mt-1 text-lg font-semibold">
            {held.size === 0
              ? "—"
              : [...held].map(([c, a]) => (
                  <span key={c} className="block"><Money amount={a} currency={c} /></span>
                ))}
          </p>
        </div>
      </div>
      <div className="card">
        <h2 className="mb-3 font-semibold">Users</h2>
        <dl className="grid gap-4 sm:grid-cols-4">
          {TRUST_TIERS.map((t) => (
            <div key={t}>
              <dt className="text-sm text-muted">{TRUST_TIER_LABELS[t]}</dt>
              <dd className="text-2xl font-bold">{tierCount.get(t) ?? 0}</dd>
            </div>
          ))}
          <div>
            <dt className="text-sm text-muted">Suspended</dt>
            <dd className="text-2xl font-bold">{suspended}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
