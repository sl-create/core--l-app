import { redirect } from "next/navigation";
import { requestLogin } from "../actions";
import { ErrorBanner } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { currentUser } from "@/lib/server/session";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await currentUser()) redirect("/dashboard");
  const { error } = await searchParams;
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Sign in to Ajo</h1>
      <p className="mb-6 text-muted">New or returning, we&apos;ll email you a link. No password needed.</p>
      <ErrorBanner message={error} />
      <form action={requestLogin} className="card space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" autoFocus />
        </div>
        <SubmitButton>Email me a sign-in link</SubmitButton>
      </form>
    </div>
  );
}
