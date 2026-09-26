import Link from "next/link";
import { DOCUMENT_LABELS } from "@/lib/domain/documents";
import { db } from "@/lib/server/db";
import { formatUtc, PageHeader, Route, StatusBadge } from "@/components/ui";

export default async function DisputesPage() {
  const disputes = await db.dispute.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    include: { booking: { include: { request: true } }, openedBy: true },
    take: 100,
  });
  return (
    <div>
      <PageHeader title="Disputes" subtitle="Oldest open disputes first." />
      {disputes.length === 0 ? (
        <p className="card text-muted">No disputes.</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {disputes.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/disputes/${d.id}`} className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-background">
                <span className="font-medium">{DOCUMENT_LABELS[d.booking.request.documentType]}</span>
                <Route origin={d.booking.request.origin} destination={d.booking.request.destination} />
                <span className="text-sm text-muted">opened by {d.openedBy.name} · {formatUtc(d.createdAt)}</span>
                <span className="ml-auto"><StatusBadge status={d.status} tone={d.status === "OPEN" ? "red" : "gray"} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
