import { setUpPayouts, verifyIdentity } from "../actions";
import {
  AJO_VERIFIED_MIN_DELIVERIES,
  TRUST_TIER_DESCRIPTIONS,
  TRUST_TIER_LABELS,
  TRUST_TIERS,
  tierRank,
} from "@/lib/domain/trust";
import { paymentsSimulated } from "@/lib/server/escrow";
import { requireUser } from "@/lib/server/session";
import { PageHeader, TrustBadge } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function AccountPage() {
  const user = await requireUser();
  const simulated = paymentsSimulated();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Your account" subtitle={user.email} />

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Trust tier</h2>
          <TrustBadge tier={user.trustTier} />
        </div>
        <ol className="space-y-3">
          {TRUST_TIERS.map((tier) => {
            const reached = tierRank(user.trustTier) >= tierRank(tier);
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
        {user.trustTier === "ID_VERIFIED" && (
          <p className="mt-5 text-sm text-muted">
            {user.completedDeliveries} of {AJO_VERIFIED_MIN_DELIVERIES} deliveries towards Ajo Verified.
          </p>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Payouts</h2>
        {user.stripeAccountId ? (
          <>
            <p className="text-sm text-muted">Your payout account is connected. Travel earnings are paid here.</p>
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
