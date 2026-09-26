import Link from "next/link";

export default async function CheckEmailPage({ searchParams }: PageProps<"/login/check">) {
  const { email, dev } = await searchParams;
  return (
    <div className="mx-auto max-w-sm text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-2xl">✉</div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Check your email</h1>
      <p className="text-muted">
        We sent a sign-in link to <strong className="text-foreground">{email}</strong>. It works
        once and expires in 15 minutes.
      </p>
      {typeof dev === "string" && process.env.NODE_ENV !== "production" && (
        <div className="card mt-6 text-left text-sm">
          <p className="mb-2 font-medium">Development: no email provider is set up</p>
          <a href={dev} className="link break-all">Open the sign-in link</a>
        </div>
      )}
      <p className="mt-6 text-sm">
        <Link href="/login" className="link">Use a different email</Link>
      </p>
    </div>
  );
}
