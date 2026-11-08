import "server-only";
import { timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { assert } from "./errors";
import { mailerConfigured, sendEmail } from "./mailer";
import { hashToken, newToken, startSession } from "./session";
import { appUrl } from "./stripe";

const LINK_TTL_MINUTES = 15;
const MAX_LINKS_PER_HOUR = 5;

/**
 * Emails a single-use sign-in link. Works the same whether or not the account
 * exists, so the form does not reveal who is registered.
 *
 * Returns the link itself (as a relative path) when there is no email provider:
 * in development, or on a demo deploy when the right access code is given.
 */
export async function requestLoginLink(rawEmail: string, accessCode = ""): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase();
  const onScreen = onScreenLinkMode();
  if (onScreen === "demo") assert(demoCodeMatches(accessCode), "That access code is not right.");
  const recent = await db.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  assert(recent < MAX_LINKS_PER_HOUR, "Too many sign-in links requested. Try again in an hour.");

  assert(mailerConfigured() || onScreen, "Email sign-in is not configured yet.");

  const token = newToken();
  await db.loginToken.create({
    data: {
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000),
    },
  });
  const path = `/auth/verify?token=${token}`;
  const link = `${appUrl()}${path}`;
  await sendEmail({
    to: email,
    subject: "Your Ajo sign-in link",
    text: `Click to sign in to Ajo:\n\n${link}\n\nThis link works once and expires in ${LINK_TTL_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
  });
  // Relative, so the on-screen link works whatever host the dev server is reached through
  // (a phone on the LAN, a tunnel or a preview proxy).
  return onScreen ? path : null;
}

/**
 * Whether sign-in links are shown on screen instead of only emailed. Only without an
 * email provider: "dev" locally, "demo" on a deploy that sets DEMO_ACCESS_CODE (anyone
 * with the code can sign in as any email, so use it only for private testing).
 */
export function onScreenLinkMode(): "dev" | "demo" | null {
  if (mailerConfigured()) return null;
  if (process.env.DEMO_ACCESS_CODE) return "demo";
  return process.env.NODE_ENV !== "production" ? "dev" : null;
}

function demoCodeMatches(given: string): boolean {
  const a = Buffer.from(given.trim());
  const b = Buffer.from(process.env.DEMO_ACCESS_CODE ?? "");
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/** Uses up a sign-in link, creating the account on first sign-in, and starts a session. */
export async function signInWithToken(token: string) {
  const tokenHash = hashToken(token);
  // Mark the token used in the same statement that checks it, so it cannot be used twice.
  const { count } = await db.loginToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  assert(count === 1, "This sign-in link has expired or was already used. Request a new one.");
  const { email } = await db.loginToken.findUniqueOrThrow({ where: { tokenHash } });
  const admin = adminEmails().has(email);
  const user = await db.user.upsert({
    where: { email },
    update: admin ? { role: "ADMIN" } : {},
    create: { email, name: "", ...(admin ? { role: "ADMIN" as const } : {}) },
  });
  assert(!user.suspendedAt, "This account is suspended. Contact Ajo support.");
  await startSession(user.id);
  return user;
}

/**
 * Emails in ADMIN_EMAILS (comma-separated) become admins when they sign in. Removing an
 * email does not demote the account; change its role in the database for that.
 */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}
