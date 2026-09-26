import "server-only";
import type { User } from "@prisma/client";
import { db } from "./db";
import { appUrl, stripe } from "./stripe";

/**
 * Starts identity verification (KYC) with Stripe Identity. The webhook upgrades
 * the user to ID_VERIFIED once Stripe confirms the check. In simulated mode
 * the upgrade happens straight away. Returns a URL to redirect to, or null.
 */
export async function startIdentityVerification(user: User): Promise<string | null> {
  if (user.trustTier !== "UNVERIFIED") return null;
  if (!stripe) {
    await db.user.update({ where: { id: user.id }, data: { trustTier: "ID_VERIFIED" } });
    return null;
  }
  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    options: { document: { require_matching_selfie: true } },
    metadata: { userId: user.id },
    return_url: `${appUrl()}/account`,
  });
  await db.user.update({ where: { id: user.id }, data: { kycSessionId: session.id } });
  if (!session.url) throw new Error("Stripe did not return a verification URL");
  return session.url;
}

export async function markIdentityVerified(userId: string, sessionId: string) {
  await db.user.updateMany({
    where: { id: userId, kycSessionId: sessionId, trustTier: "UNVERIFIED" },
    data: { trustTier: "ID_VERIFIED" },
  });
}

/** Creates or resumes Stripe Connect onboarding so a traveller can receive payouts. */
export async function startPayoutOnboarding(user: User): Promise<string | null> {
  if (!stripe) {
    if (!user.stripeAccountId) {
      await db.user.update({
        where: { id: user.id },
        data: { stripeAccountId: `sim_acct_${user.id}` },
      });
    }
    return null;
  }
  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: { transfers: { requested: true } },
      metadata: { userId: user.id },
    });
    accountId = account.id;
    await db.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appUrl()}/account`,
    return_url: `${appUrl()}/account`,
  });
  return link.url;
}
