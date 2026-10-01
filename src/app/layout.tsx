import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { logout } from "./actions";
import { currentUser } from "@/lib/server/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ajo: documents home, carried by people you can trust",
  description:
    "Ajo connects the Nigerian diaspora with verified travellers who carry important documents between Lagos, London and New York.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await currentUser();
  return (
    // Browser extensions (password managers, Grammarly, etc.) often add attributes to
    // <html> and <body> before React loads. Ignore those differences on these two tags only.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans" suppressHydrationWarning>
        <header className="border-b border-border bg-surface/80 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 text-sm sm:gap-5">
            <Link href="/" className="text-xl font-bold tracking-tight text-brand">
              ajo
            </Link>
            {user && (
              <>
                <Link href="/dashboard" className="hover:text-brand">Dashboard</Link>
                <Link href="/trips" className="hover:text-brand">Trips</Link>
                <Link href="/account" className="hover:text-brand">Account</Link>
                {user.role === "ADMIN" && (
                  <Link href="/admin" className="hover:text-brand">Admin</Link>
                )}
              </>
            )}
            <div className="ml-auto flex items-center gap-3">
              {user ? (
                <>
                  <span className="hidden text-muted sm:inline">{user.name}</span>
                  <form action={logout}>
                    <button className="btn-secondary">Sign out</button>
                  </form>
                </>
              ) : (
                <Link href="/login" className="btn-primary">Sign in</Link>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          <Link href="/levels" className="mr-3 hover:text-brand">Traveller levels</Link>
          Ajo means &ldquo;journey&rdquo; in Yoruba.
        </footer>
      </body>
    </html>
  );
}
