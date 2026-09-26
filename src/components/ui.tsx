import { formatMoney, LOCATION_LABELS, type Currency, type Location } from "@/lib/domain/locations";
import { TRUST_TIER_LABELS, type TrustTier } from "@/lib/domain/trust";

export function formatUtc(date: Date): string {
  return (
    new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

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

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[STATUS_TONES[status] ?? "gray"];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

export function TrustBadge({ tier }: { tier: TrustTier }) {
  const tone =
    tier === "AJO_VERIFIED" ? TONES.green : tier === "ID_VERIFIED" ? TONES.amber : TONES.gray;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>
      {tier === "AJO_VERIFIED" && "✓ "}
      {TRUST_TIER_LABELS[tier]}
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
