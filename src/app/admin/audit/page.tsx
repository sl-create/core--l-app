import Link from "next/link";
import { db } from "@/lib/server/db";
import { formatUtc, PageHeader } from "@/components/ui";

const targetHref = (type: string, id: string) =>
  type === "User" ? `/admin/users/${id}` : type === "Dispute" ? `/admin/disputes/${id}` : null;

export default async function AuditPage() {
  const entries = await db.auditLog.findMany({
    include: { admin: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every admin action, newest first." />
      {entries.length === 0 ? (
        <p className="card text-muted">Nothing yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">Details</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((e) => {
              const href = targetHref(e.targetType, e.targetId);
              return (
                <tr key={e.id} className="align-top">
                  <td className="whitespace-nowrap p-3 text-muted">{formatUtc(e.createdAt)}</td>
                  <td className="p-3">{e.admin.name}</td>
                  <td className="p-3">{href ? <Link href={href} className="link">{e.action}</Link> : e.action}</td>
                  <td className="break-all p-3 text-muted">{e.details ? JSON.stringify(e.details) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
