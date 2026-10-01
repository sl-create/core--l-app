import Link from "next/link";
import { levelOf } from "@/lib/domain/levels";
import { currentUser } from "@/lib/server/session";
import { LevelLadder } from "@/components/levels";

export const metadata = { title: "Traveller levels · Ajo" };

export default async function LevelsPage() {
  const user = await currentUser();
  const level = user ? levelOf(user) : null;
  return (
    <div className="space-y-10">
      <section className="text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">For travellers</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold tracking-tight">
          The further you go, the more Ajo gives back
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted">
          Every verified traveller starts as <strong>Arìnrìn-àjò</strong>. Deliver on time and earn
          good ratings to climb, with bigger payouts, top spots in matching and first look at the
          most valuable requests.
        </p>
      </section>

      <LevelLadder current={level} />

      <section className="card grid gap-6 sm:grid-cols-3">
        <div>
          <h2 className="font-semibold">Paid by Ajo, not senders</h2>
          <p className="mt-1 text-sm text-muted">
            Level bonuses come out of Ajo&apos;s own service fee, so senders pay the same whoever
            carries their document. The bonus is paid when the delivery completes.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Earned, and kept by doing well</h2>
          <p className="mt-1 text-sm text-muted">
            Your level is worked out from your record after every delivery. Lost disputes and
            cancelling paid bookings can bring it down, and good work brings it back up.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">First look at valuable requests</h2>
          <p className="mt-1 text-sm text-muted">
            New requests reach Àgbà instantly and other levels a little later. Senders can reserve
            important documents for higher levels.
          </p>
        </div>
      </section>

      <p className="text-center">
        <Link href={user ? "/trips/new" : "/login"} className="btn-primary px-6 py-3 text-base">
          {user ? "Add a trip" : "Start travelling with Ajo"}
        </Link>
      </p>
    </div>
  );
}
