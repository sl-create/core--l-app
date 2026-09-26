import Link from "next/link";
import { verifyLogin } from "../../actions";
import { SubmitButton } from "@/components/submit-button";

// Signing in takes a button press rather than happening on page load, because
// email security scanners open links and would otherwise use up the token.
export default async function VerifyPage({ searchParams }: PageProps<"/auth/verify">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) {
    return (
      <div className="mx-auto max-w-sm text-center">
        <h1 className="mb-2 text-2xl font-bold">Invalid link</h1>
        <Link href="/login" className="link">Request a new sign-in link</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-sm text-center">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Welcome to Ajo</h1>
      <form action={verifyLogin.bind(null, token)}>
        <SubmitButton>Continue to Ajo</SubmitButton>
      </form>
    </div>
  );
}
