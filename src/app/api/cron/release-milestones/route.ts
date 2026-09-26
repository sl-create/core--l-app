import { releaseExpiredClaims, retryFailedTransfers } from "@/lib/server/bookings";

/**
 * Confirms milestone claims whose window has lapsed and retries failed payouts.
 * Call it every 15 minutes or so, e.g. from Vercel Cron.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const released = await releaseExpiredClaims();
  const retried = await retryFailedTransfers();
  return Response.json({ released, retried });
}
