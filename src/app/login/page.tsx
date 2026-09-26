import { redirect } from "next/navigation";
import { login } from "../actions";
import { ErrorBanner } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { currentUser, demoLoginEnabled } from "@/lib/server/session";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Sign in to Ajo</h1>
      <ErrorBanner message={error} />
      {demoLoginEnabled() ? (
        <form action={login} className="card space-y-4">
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input className="input" id="name" name="name" required autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <SubmitButton>Continue</SubmitButton>
          <p className="hint">
            Development sign-in: there is no password yet. Email magic links come before launch.
          </p>
        </form>
      ) : (
        <p className="card text-muted">Sign-in is not available yet.</p>
      )}
    </div>
  );
}
