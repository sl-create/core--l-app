import { redirect } from "next/navigation";
import { completeProfile } from "../actions";
import { ErrorBanner } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireSignedIn } from "@/lib/server/session";

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const user = await requireSignedIn();
  if (user.name) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">One last thing</h1>
      <p className="mb-6 text-muted">What should senders and travellers call you?</p>
      <ErrorBanner message={error} />
      <form action={completeProfile} className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name</label>
          <input className="input" id="name" name="name" required autoComplete="name" autoFocus />
          <p className="hint">Use the name on your ID. You&apos;ll need it to get verified.</p>
        </div>
        <SubmitButton>Get started</SubmitButton>
      </form>
    </div>
  );
}
