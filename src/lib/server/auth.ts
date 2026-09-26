import "server-only";
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
 * Returns the link itself only in development without an email provider, so
 * you can sign in locally.
 */
export async function requestLoginLink(rawEmail: string): Promise<string | null> {
  const email = rawEmail.trim().toLowerCase();
  const recent = await db.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  assert(recent < MAX_LINKS_PER_HOUR, "Too many sign-in links requested. Try again in an hour.");

  const devMode = !mailerConfigured() && process.env.NODE_ENV !== "production";
  assert(mailerConfigured() || devMode, "Email sign-in is not configured yet.");

  const token = newToken();
  await db.loginToken.create({
    data: {
      email,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + LINK_TTL_MINUTES * 60 * 1000),
    },
  });
  const link = `${appUrl()}/auth/verify?token=${token}`;
  await sendEmail({
    to: email,
    subject: "Your Ajo sign-in link",
    text: `Click to sign in to Ajo:\n\n${link}\n\nThis link works once and expires in ${LINK_TTL_MINUTES} minutes. If you didn't ask for it, you can ignore this email.`,
  });
  return devMode ? link : null;
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
  const user = await db.user.upsert({ where: { email }, update: {}, create: { email, name: "" } });
  assert(!user.suspendedAt, "This account is suspended. Contact Ajo support.");
  await startSession(user.id);
  return user;
}
