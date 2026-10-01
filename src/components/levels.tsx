import { formatMoney } from "@/lib/domain/locations";
import {
  LEVEL_INFO,
  LEVELS,
  levelBonus,
  levelChecks,
  nextLevel,
  type Level,
  type TravellerStats,
} from "@/lib/domain/levels";
import { quote } from "@/lib/domain/pricing";
import { LevelBadge } from "./ui";

function perks(level: Level): string[] {
  const info = LEVEL_INFO[level];
  // A typical booking, to show the bonus as money rather than a percentage.
  const example = quote({ origin: "LAGOS", destination: "LONDON", deadline: new Date(Date.now() + 20 * 864e5) });
  const bonus = levelBonus(level, example.serviceFee);
  return [
    info.feeShare > 0
      ? `Bigger payouts: ${Math.round(info.feeShare * 100)}% of Ajo's fee as a bonus (e.g. +${formatMoney(bonus, example.currency)} on a standard Lagos–London job)`
      : "Standard payout",
    level === "ARINRIN_AJO"
      ? "Listed to senders by arrival time"
      : level === "AGBA"
        ? "Listed first to senders, above every other level"
        : `Listed to senders above ${LEVEL_INFO[LEVELS[LEVELS.indexOf(level) - 1]].name} travellers`,
    info.feedDelayHours === 0
      ? "Sees new requests the moment they're posted"
      : `Sees new requests ${info.feedDelayHours}h after posting${level !== "ARINRIN_AJO" ? ` (${24 - info.feedDelayHours}h before Arìnrìn-àjò)` : ""}`,
    ...(level === "OLOOOTO" ? ["Can carry requests reserved for Olóòótọ́, including “other” documents"] : []),
    ...(level === "ATONA" ? ["Can carry requests reserved for Atọ́nà"] : []),
    ...(level === "AGBA" ? ["Can carry every request on Ajo", "Priority support from the Ajo team"] : []),
  ];
}

function requirements(level: Level): string[] {
  const r = LEVEL_INFO[level].requirements;
  if (level === "ARINRIN_AJO") return ["Verify your ID"];
  return [
    `${r.deliveries}+ completed deliveries`,
    `${r.rating}★ average rating`,
    ...(r.onTimeRate > 0 ? [`${Math.round(r.onTimeRate * 100)}% on time`] : []),
    `At most ${Math.round(r.maxStrikeRate * 100)}% disputes lost or cancellations`,
    ...(r.adminApproval ? ["Approved by the Ajo team"] : []),
  ];
}

export function LevelLadder({ current }: { current?: Level | null }) {
  return (
    <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {LEVELS.map((level) => {
        const info = LEVEL_INFO[level];
        const isCurrent = level === current;
        return (
          <li
            key={level}
            className={`card flex flex-col ${isCurrent ? "border-brand ring-2 ring-brand/30" : ""}`}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <LevelBadge level={level} />
              {isCurrent && <span className="text-xs font-semibold text-brand">You are here</span>}
            </div>
            <h3 className="text-xl font-bold tracking-tight">{info.name}</h3>
            <p className="text-sm text-muted">{info.meaning}</p>
            <p className="mt-2 text-sm">{info.blurb}</p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">To reach it</p>
            <ul className="mt-1 space-y-1 text-sm">
              {requirements(level).map((r) => <li key={r}>• {r}</li>)}
            </ul>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Perks</p>
            <ul className="mt-1 space-y-1 text-sm">
              {perks(level).map((p) => <li key={p} className="flex gap-1.5"><span className="text-brand">✓</span>{p}</li>)}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}

export function LevelProgress({ level, stats }: { level: Level; stats: TravellerStats }) {
  const next = nextLevel(level);
  if (!next) {
    return <p className="text-sm">You&apos;ve reached the top of Ajo. Thank you for everything you carry.</p>;
  }
  const checks = levelChecks(next, stats);
  return (
    <div>
      <p className="mb-3 text-sm">
        Next: <LevelBadge level={next} showMeaning />
      </p>
      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span>{c.met ? "✓ " : ""}{c.label}</span>
              <span className="text-muted">{c.current} / {c.target}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full ${c.met ? "bg-brand" : "bg-accent"}`}
                style={{ width: `${Math.round(c.progress * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
