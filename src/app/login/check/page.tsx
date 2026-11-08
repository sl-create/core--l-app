import Link from "next/link";
import { onScreenLinkMode } from "@/lib/server/auth";

export default async function CheckEmailPage({ searchParams }: PageProps<"/login/check">) {
  const { email, dev } = await searchParams;
  const mode = onScreenLinkMode();
  // Only ever render our own verify path, never an arbitrary URL from the query string.
  const link = mode && typeof dev === "string" && dev.startsWith("/auth/verify?token=") ? dev : null;
  return (
    <div className="mx-auto max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-2xl">✉</div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight">
        {mode === "demo" && link ? "Your sign-in link" : "Check your email"}
      </h1>
      <p className="text-muted">
        {mode === "demo" && link ? "Here is" : "We sent"} a sign-in link for{" "}
        <strong className="text-foreground">{email}</strong>. It works once and expires in 15 minutes.
      </p>
      {link && (
        <div className="card mt-6 text-left text-sm">
          <p className="mb-2 font-medium">
            {mode === "demo" ? "Test version: no email is sent" : "Development: no email provider is set up"}
          </p>
          <a href={link} className="link break-all">Open the sign-in link</a>
        </div>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="link">Use a different email</Link>
      </p>
    </div>
  );
}
