import Link from "next/link";
import { currentUser } from "@/lib/server/session";

const STEPS = [
  {
    title: "Post what needs moving",
    body: "A birth certificate in Lagos, a degree certificate in London. Say where it is, where it needs to go, and by when.",
  },
  {
    title: "Match with a verified traveller",
    body: "Travellers already flying Lagos, London and New York post their trips. We match you by route and date.",
  },
  {
    title: "Pay into escrow, release by milestone",
    body: "Your payment is held securely and released step by step: handover, landing, delivery.",
  },
];

export default async function Home() {
  const user = await currentUser();
  return (
    <div className="space-y-16">
      <section className="pt-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          Lagos · London · New York
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Your important documents, carried home by people you can trust.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
          Ajo connects the Nigerian diaspora with verified travellers who are already making the
          journey, so a birth certificate or NIN slip reaches you in days, not months.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={user ? "/requests/new" : "/login"} className="btn-primary px-6 py-3 text-base">
            Send a document
          </Link>
          <Link href={user ? "/trips/new" : "/login"} className="btn-secondary px-6 py-3 text-base">
            I&apos;m travelling
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.title} className="card">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft font-bold text-brand-strong">
              {i + 1}
            </div>
            <h2 className="font-semibold">{step.title}</h2>
            <p className="mt-2 text-sm text-muted">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="card grid gap-6 sm:grid-cols-3">
        <div>
          <h3 className="font-semibold">Verified, then proven</h3>
          <p className="mt-1 text-sm text-muted">
            Every traveller passes an ID and selfie check, then climbs from Arìnrìn-àjò to Àgbà by
            delivering on time. <Link href="/levels" className="link">See the levels</Link>
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Claim windows</h3>
          <p className="mt-1 text-sm text-muted">
            You get 72, 48, 24 or 12 hours to confirm each step, depending on how close your
            deadline is. If something is wrong, you can dispute it before any money moves.
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Clear cancellation</h3>
          <p className="mt-1 text-sm text-muted">
            Each trip has a Flexible, Moderate or Strict policy, so you know your refund before
            you book.
          </p>
        </div>
      </section>
    </div>
  );
}
