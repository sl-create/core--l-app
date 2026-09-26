import Link from "next/link";
import { db } from "@/lib/server/db";
import { PageHeader, TrustBadge } from "@/components/ui";

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { name: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return (
    <div>
      <PageHeader title="Users" />
      <form className="mb-6 flex gap-2">
        <input className="input max-w-sm" name="q" defaultValue={query} placeholder="Search name or email" />
        <button className="btn-secondary">Search</button>
      </form>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/admin/users/${u.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-background">
              <span className="font-medium">{u.name || "(no name)"}</span>
              <span className="text-sm text-muted">{u.email}</span>
              {u.role === "ADMIN" && <span className="text-xs font-semibold uppercase">Admin</span>}
              {u.suspendedAt && <span className="text-xs font-semibold uppercase text-danger">Suspended</span>}
              <span className="ml-auto"><TrustBadge tier={u.trustTier} /></span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
