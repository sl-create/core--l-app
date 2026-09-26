import Link from "next/link";
import { requireAdmin } from "@/lib/server/admin";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/audit", label: "Audit log" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div>
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-border pb-3 text-sm">
        <span className="mr-2 rounded-full bg-foreground px-2.5 py-1 text-xs font-semibold text-background">
          Admin
        </span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-full px-3 py-1 hover:bg-surface">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
