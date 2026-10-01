import Link from "next/link";
import { setUpPayouts, verifyIdentity } from "../actions";
import { averageRating, LEVEL_INFO, levelOf } from "@/lib/domain/levels";
import { TRUST_TIER_DESCRIPTIONS, TRUST_TIER_LABELS, TRUST_TIERS } from "@/lib/domain/trust";
import { paymentsSimulated } from "@/lib/server/escrow";
import { requireUser } from "@/lib/server/session";
import { LevelProgress } from "@/components/levels";
import { LevelBadge, PageHeader, TrustBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function AccountPage() {
  const user = await requireUser();
  const simulated = paymentsSimulated();
  const level = levelOf(user);
  const stats = { ...user, elderApproved: user.elderApprovedAt !== null };
  const onTime = user.completedDeliveries
    ? Math.round((user.onTimeDeliveries / user.completedDeliveries) * 100)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Your account" subtitle={user.email} />

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Verification</h2>
          <TrustBadge tier={user.trustTier} />
        </div>
        <ol className="space-y-3">
          {TRUST_TIERS.map((tier, i) => {
            const reached = TRUST_TIERS.indexOf(user.trustTier) >= i;
            return (
              <li key={tier} className={`flex gap-3 ${reached ? "" : "opacity-60"}`}>
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${reached ? "bg-brand text-white dark:text-black" : "border border-border"}`}>
                  {reached ? "✓" : ""}
                </span>
                <div>
                  <p className="font-medium">{TRUST_TIER_LABELS[tier]}</p>
                  <p className="text-sm text-muted">{TRUST_TIER_DESCRIPTIONS[tier]}</p>
                </div>
              </li>
            );
          })}
        </ol>
        {user.trustTier === "UNVERIFIED" && (
          <form action={verifyIdentity} className="mt-5">
            <SubmitButton>Verify my ID</SubmitButton>
            <p className="hint">
              {simulated
                ? "Test mode: verification is simulated and completes straight away."
                : "You'll scan a government ID and take a selfie with Stripe Identity."}
            </p>
          </form>
        )}
      </section>

      <section className="card">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Traveller level</h2>
          <Link href="/levels" className="link text-sm">How levels work →</Link>
        </div>
        {level ? (
          <>
            <div className="my-4 flex flex-wrap items-center gap-4 rounded-xl bg-background p-4">
              <div className="flex-1">
                <p className="text-2xl font-bold tracking-tight">{LEVEL_INFO[level].name}</p>
                <p className="text-sm text-muted">{LEVEL_INFO[level].meaning} · {LEVEL_INFO[level].blurb}</p>
              </div>
              <LevelBadge level={level} />
            </div>
            <dl className="mb-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted">Deliveries</dt>
                <dd className="text-xl font-bold">{user.completedDeliveries}</dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted">Rating</dt>
                <dd className="text-xl font-bold">
                  {user.ratingCount ? `${averageRating(user)!.toFixed(1)}★` : "–"}
                </dd>
              </div>
              <div className="rounded-xl border border-border p-3">
                <dt className="text-xs text-muted">On time</dt>
                <dd className="text-xl font-bold">{onTime === null ? "–" : `${onTime}%`}</dd>
              </div>
            </dl>
            <LevelProgress level={level} stats={stats} />
            <p className="mt-4 text-sm">
              <Link href={`/travellers/${user.id}`} className="link">View your public profile →</Link>
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Verify your ID to start carrying documents as <LevelBadge level="ARINRIN_AJO" />.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Payouts</h2>
        {user.stripeAccountId ? (
          <>
            <p className="text-sm text-muted">Your payout account is connected. Travel earnings and level bonuses are paid here.</p>
            {!simulated && (
              <form action={setUpPayouts} className="mt-3">
                <SubmitButton variant="secondary">Update payout details</SubmitButton>
              </form>
            )}
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              Travellers need a payout account before accepting bookings.
            </p>
            <form action={setUpPayouts}>
              <SubmitButton>Set up payouts</SubmitButton>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
