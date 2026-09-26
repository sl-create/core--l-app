import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";

const COOKIE = "ajo_session";
const SESSION_DAYS = 30;

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { userId, tokenHash: hashToken(token), expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}

/** Signs a user out everywhere, for example when they are suspended. */
export async function endAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

/** The signed-in user, or null. Cached for the duration of a request. */
export const currentUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.suspendedAt) return null;
  return session.user;
});

/** A signed-in user who may not have finished onboarding yet. */
export async function requireSignedIn() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** A signed-in user with a completed profile. */
export async function requireUser() {
  const user = await requireSignedIn();
  if (!user.name) redirect("/welcome");
  return user;
}
