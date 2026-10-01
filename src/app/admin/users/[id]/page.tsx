import Link from "next/link";
import { notFound } from "next/navigation";
import { setElderApproval, setSuspended, setTrustTier } from "../../actions";
import { averageRating, levelOf } from "@/lib/domain/levels";
import { LevelProgress } from "@/components/levels";
import { TRUST_TIER_LABELS, TRUST_TIERS } from "@/lib/domain/trust";
import { db } from "@/lib/server/db";
import { ErrorBanner, Field, formatUtc, LevelBadge, PageHeader, StatusBadge, TrustBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function AdminUserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  const level = levelOf(user);
  const avg = averageRating(user);
  const [bookings, log] = await Promise.all([
    db.booking.findMany({
      where: { OR: [{ request: { senderId: id } }, { trip: { travellerId: id } }] },
      include: { request: true, trip: true },
      orderBy: { proposedAt: "desc" },
      take: 20,
    }),
    db.auditLog.findMany({
      where: { targetType: "User", targetId: id },
      include: { admin: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name || user.email}
        subtitle={user.email}
        action={
          <div className="flex gap-2">
            <TrustBadge tier={user.trustTier} />
            {level && <LevelBadge level={level} showMeaning />}
          </div>
        }
      />
      <ErrorBanner message={error} />
      {user.suspendedAt && (
        <p className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          Suspended since {formatUtc(user.suspendedAt)}. They cannot sign in and their trips are hidden.
        </p>
      )}
      <section className="card">
        <dl className="grid gap-4 sm:grid-cols-4">
          <Field label="Joined">{formatUtc(user.createdAt)}</Field>
          <Field label="Role">{user.role}</Field>
          <Field label="Deliveries">{user.completedDeliveries} ({user.onTimeDeliveries} on time)</Field>
          <Field label="Rating">{avg === null ? "–" : `${avg.toFixed(2)}★ from ${user.ratingCount}`}</Field>
          <Field label="Upheld disputes">{user.upheldDisputes}</Field>
          <Field label="Paid bookings cancelled">{user.travellerCancellations}</Field>
          <Field label="Àgbà approval">{user.elderApprovedAt ? formatUtc(user.elderApprovedAt) : "No"}</Field>
        </dl>
      </section>

      {level && (
        <section className="card">
          <h2 className="mb-3 font-semibold">Level progress</h2>
          <LevelProgress level={level} stats={{ ...user, elderApproved: user.elderApprovedAt !== null }} />
          <form action={setElderApproval.bind(null, user.id, !user.elderApprovedAt)} className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            <input className="input flex-1" name="reason" required placeholder="Reason (logged)" />
            <SubmitButton variant={user.elderApprovedAt ? "danger" : "secondary"}>
              {user.elderApprovedAt ? "Revoke Àgbà approval" : "Approve for Àgbà"}
            </SubmitButton>
          </form>
          <p className="hint">
            Approval is one of the Àgbà requirements. They still need to meet the others to reach the level.
          </p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <form action={setTrustTier.bind(null, user.id)} className="card space-y-3">
          <h2 className="font-semibold">Trust tier</h2>
          <select className="input" name="tier" defaultValue={user.trustTier}>
            {TRUST_TIERS.map((t) => <option key={t} value={t}>{TRUST_TIER_LABELS[t]}</option>)}
          </select>
          <input className="input" name="reason" required placeholder="Reason (logged)" />
          <SubmitButton variant="secondary">Update tier</SubmitButton>
        </form>
        <form action={setSuspended.bind(null, user.id, !user.suspendedAt)} className="card space-y-3">
          <h2 className="font-semibold">{user.suspendedAt ? "Lift suspension" : "Suspend account"}</h2>
          <input className="input" name="reason" required placeholder="Reason (logged)" />
          <SubmitButton
            variant={user.suspendedAt ? "secondary" : "danger"}
            confirm={user.suspendedAt ? undefined : "Suspend this user? They will be signed out."}
          >
            {user.suspendedAt ? "Lift suspension" : "Suspend"}
          </SubmitButton>
        </form>
      </div>

      <section>
        <h2 className="mb-3 font-semibold">Bookings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface text-sm">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-background">
                  <span>{b.request.senderId === id ? "Sender" : "Traveller"}</span>
                  <span className="text-muted">{formatUtc(b.proposedAt)}</span>
                  <span className="ml-auto"><StatusBadge status={b.status} /></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Admin history</h2>
        {log.length === 0 ? (
          <p className="text-sm text-muted">None.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {log.map((l) => (
              <li key={l.id}>
                <span className="text-muted">{formatUtc(l.createdAt)}</span> · {l.admin.name}: {l.action}{" "}
                <span className="text-muted">{JSON.stringify(l.details)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
