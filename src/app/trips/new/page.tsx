import Link from "next/link";
import { createTrip } from "../../actions";
import { CANCELLATION_POLICIES, CANCELLATION_POLICY_DESCRIPTIONS } from "@/lib/domain/cancellation";
import { LOCATION_LABELS, LOCATIONS } from "@/lib/domain/locations";
import { canCarry } from "@/lib/domain/trust";
import { requireUser } from "@/lib/server/session";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function NewTripPage({ searchParams }: PageProps<"/trips/new">) {
  const user = await requireUser();
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Add a trip" subtitle="Earn money carrying documents on a flight you're already taking." />
      <ErrorBanner message={error} />
      {!canCarry(user.trustTier) && (
        <div className="mb-6 rounded-xl border border-accent/40 bg-amber-50 px-4 py-3 text-sm dark:bg-amber-950/40">
          You can post a trip now, but senders can only book you once you&apos;ve{" "}
          <Link href="/account" className="link">verified your ID</Link>.
        </div>
      )}
      <form action={createTrip} className="card space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="origin">Flying from</label>
            <select className="input" id="origin" name="origin" defaultValue="LAGOS">
              {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="destination">Flying to</label>
            <select className="input" id="destination" name="destination" defaultValue="LONDON">
              {LOCATIONS.map((l) => <option key={l} value={l}>{LOCATION_LABELS[l]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="departureAt">Departure (UTC)</label>
            <input className="input" id="departureAt" name="departureAt" type="datetime-local" required />
          </div>
          <div>
            <label className="label" htmlFor="arrivalAt">Arrival (UTC)</label>
            <input className="input" id="arrivalAt" name="arrivalAt" type="datetime-local" required />
          </div>
          <div>
            <label className="label" htmlFor="capacity">Documents you can carry</label>
            <input className="input" id="capacity" name="capacity" type="number" min={1} max={10} defaultValue={2} required />
          </div>
        </div>
        <fieldset>
          <legend className="label">Cancellation policy</legend>
          <div className="space-y-2">
            {CANCELLATION_POLICIES.map((p) => (
              <label key={p} className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft/50">
                <input type="radio" name="cancellationPolicy" value={p} defaultChecked={p === "MODERATE"} className="mt-1 accent-[var(--brand)]" />
                <span>
                  <span className="font-medium">{p.charAt(0) + p.slice(1).toLowerCase()}</span>
                  <span className="block text-sm text-muted">{CANCELLATION_POLICY_DESCRIPTIONS[p]}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="notes">Notes for senders (optional)</label>
          <textarea className="input" id="notes" name="notes" rows={2} placeholder="e.g. Can collect anywhere in Lekki or VI" />
        </div>
        <SubmitButton>Post trip</SubmitButton>
      </form>
    </div>
  );
}
