import { formatUtc } from "@/lib/format";
import { formatMoney, LOCATION_LABELS, type Currency, type Location } from "@/lib/domain/locations";
import { LEVEL_INFO, LEVELS, levelRank, type Level } from "@/lib/domain/levels";
import { TRUST_TIER_LABELS, type TrustTier } from "@/lib/domain/trust";

export function Money({ amount, currency }: { amount: number; currency: string }) {
  return <>{formatMoney(amount, currency as Currency)}</>;
}

export function Route({ origin, destination }: { origin: Location; destination: Location }) {
  return (
    <span className="font-medium">
      {LOCATION_LABELS[origin]} <span className="text-muted">→</span> {LOCATION_LABELS[destination]}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBanner({ message }: { message?: string | string[] }) {
  const text = Array.isArray(message) ? message[0] : message;
  if (!text) return null;
  return (
    <div role="alert" className="mb-6 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      {text}
    </div>
  );
}

const TONES = {
  green: "bg-brand-soft text-brand-strong",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  red: "bg-danger-soft text-danger",
  gray: "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300",
} as const;

const STATUS_TONES: Record<string, keyof typeof TONES> = {
  OPEN: "green",
  BOOKED: "amber",
  DELIVERED: "green",
  COMPLETED: "green",
  CANCELLED: "gray",
  DECLINED: "gray",
  PROPOSED: "amber",
  ACCEPTED: "amber",
  FUNDED: "green",
  DISPUTED: "red",
  PENDING: "gray",
  CLAIMED: "amber",
  CONFIRMED: "green",
};

export function StatusBadge({ status, tone: override }: { status: string; tone?: keyof typeof TONES }) {
  const tone = TONES[override ?? STATUS_TONES[status] ?? "gray"];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function TrustBadge({ tier }: { tier: TrustTier }) {
  const tone = tier === "ID_VERIFIED" ? TONES.green : TONES.gray;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {tier === "ID_VERIFIED" && "✓ "}
      {TRUST_TIER_LABELS[tier]}
    </span>
  );
}

const LEVEL_STYLES: Record<Level, string> = {
  ARINRIN_AJO: "bg-stone-100 text-stone-700 ring-stone-300 dark:bg-stone-800 dark:text-stone-200 dark:ring-stone-600",
  OLOOOTO: "bg-emerald-50 text-emerald-800 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-700",
  ATONA: "bg-indigo-50 text-indigo-800 ring-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:ring-indigo-700",
  AGBA: "bg-amber-50 text-amber-900 ring-amber-400 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-600",
};

export function LevelPips({ level }: { level: Level }) {
  const rank = levelRank(level);
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {LEVELS.map((l, i) => (
        <span key={l} className={`h-1.5 w-1.5 rounded-full ${i <= rank ? "bg-current" : "bg-current opacity-20"}`} />
      ))}
    </span>
  );
}

/** A traveller's level. Pass null for someone who is not verified yet. */
export function LevelBadge({ level, showMeaning = false }: { level: Level | null; showMeaning?: boolean }) {
  if (!level) return <TrustBadge tier="UNVERIFIED" />;
  const info = LEVEL_INFO[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${LEVEL_STYLES[level]}`}
      title={`${info.name}: ${info.meaning}`}
    >
      <LevelPips level={level} />
      {info.name}
      {showMeaning && <span className="font-normal opacity-75">· {info.meaning}</span>}
    </span>
  );
}

export function Stars({ value, count }: { value: number | null; count?: number }) {
  if (value === null) return <span className="text-xs text-muted">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className="text-amber-500" aria-hidden>★</span>
      <span className="font-medium">{value.toFixed(1)}</span>
      {count !== undefined && <span className="text-muted">({count})</span>}
    </span>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

export { formatUtc };
