import Link from "next/link";
import type { Trip, User } from "@prisma/client";
import { offerToCarry } from "@/app/actions";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { LEVEL_INFO, levelBonus, levelOf, meetsLevel, visibleFrom } from "@/lib/domain/levels";
import { ineligibilityReasons } from "@/lib/domain/matching";
import { quote } from "@/lib/domain/pricing";
import { db } from "@/lib/server/db";
import { formatUtc, LevelBadge, Money } from "./ui";
import { SubmitButton } from "./submit-button";

const HIGH_VALUE = ["EXPRESS", "URGENT"];

/**
 * Open requests this trip could carry. Higher levels see new requests sooner,
 * requests reserved for a higher level are shown locked, and urgent requests
 * (which pay more) are flagged.
 */
export async function RequestFeed({ trip, traveller, seatsLeft }: { trip: Trip; traveller: User; seatsLeft: number }) {
  const level = levelOf(traveller);
  if (!level) {
    return (
      <p className="card text-sm text-muted">
        <Link href="/account" className="link">Verify your ID</Link> to see requests you could carry on this trip.
      </p>
    );
  }
  const now = new Date();
  const candidates = await db.deliveryRequest.findMany({
    where: {
      status: "OPEN",
      origin: trip.origin,
      destination: trip.destination,
      senderId: { not: traveller.id },
      bookings: { none: { status: { in: ["ACCEPTED", "FUNDED", "DISPUTED", "COMPLETED"] } } },
    },
    include: { bookings: { where: { tripId: trip.id, status: "PROPOSED" }, select: { id: true } } },
    orderBy: { deadline: "asc" },
    take: 100,
  });

  const fitting = candidates.filter((r) =>
    ineligibilityReasons(r, { ...trip, capacityRemaining: seatsLeft, travellerLevel: level }, now).every(
      (reason) => reason === "LEVEL",
    ),
  );
  const visible = fitting.filter((r) => visibleFrom(r.createdAt, level) <= now);
  const upcoming = fitting.filter((r) => visibleFrom(r.createdAt, level) > now);
  const nextUnlock = upcoming
    .map((r) => visibleFrom(r.createdAt, level))
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div className="space-y-3">
      {upcoming.length > 0 && (
        <div className="rounded-xl border border-dashed border-accent/60 px-4 py-3 text-sm">
          <strong>{upcoming.length} new request{upcoming.length > 1 && "s"}</strong> on this route{" "}
          {upcoming.length > 1 ? "are" : "is"} with higher-level travellers first. The next one reaches
          you at {formatUtc(nextUnlock)}.{" "}
          <Link href="/levels" className="link">Level up to see requests sooner</Link>
        </div>
      )}
      {visible.length === 0 ? (
        <p className="card text-sm text-muted">No open requests fit this trip right now. We&apos;ll show them here as senders post.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => {
            const q = quote(r);
            const bonus = levelBonus(level, q.serviceFee);
            const locked = !meetsLevel(level, r.minLevel);
            const offered = r.bookings[0];
            return (
              <li key={r.id} className={`card flex flex-wrap items-center gap-4 ${locked ? "opacity-70" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{DOCUMENT_LABELS[r.documentType]}</span>
                    {HIGH_VALUE.includes(q.urgency) && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                        {q.urgency === "URGENT" ? "Urgent · 2× pay" : "Express · 1.5× pay"}
                      </span>
                    )}
                    {r.minLevel !== "ARINRIN_AJO" && (
                      <span className="text-xs text-muted">
                        Reserved for <LevelBadge level={r.minLevel} /> and above
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    Pickup {r.pickupCity} · deliver by {formatUtc(r.deadline)}
                  </p>
                  <p className="mt-1 text-sm">
                    You earn <strong><Money amount={q.travellerPayout + bonus} currency={q.currency} /></strong>
                    {bonus > 0 && (
                      <span className="text-muted">
                        {" "}(<Money amount={q.travellerPayout} currency={q.currency} /> + <Money amount={bonus} currency={q.currency} /> {LEVEL_INFO[level].name} bonus)
                      </span>
                    )}
                  </p>
                </div>
                {locked ? (
                  <span className="text-sm text-muted">🔒 Reach {LEVEL_INFO[r.minLevel].name} to carry this</span>
                ) : offered ? (
                  <Link href={`/bookings/${offered.id}`} className="btn-secondary">Offer sent</Link>
                ) : (
                  <form action={offerToCarry.bind(null, trip.id, r.id)}>
                    <SubmitButton>Offer to carry</SubmitButton>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
