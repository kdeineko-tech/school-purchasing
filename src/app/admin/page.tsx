import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";
import { NoAccess } from "./no-access";

// Налаштування школи — лише для адміністратора (AC-ORG-09).
export default async function AdminHome() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess viewer={viewer} />;

  return (
    <PageShell viewer={viewer} title="Settings" description="School employees, departments and roles">
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsCard href="/admin/staff" title="Employees" text="Roles, departments and requesters" />
        <SettingsCard href="/admin/departments" title="Departments" text="Create school departments" />
      </div>
    </PageShell>
  );
}

function SettingsCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary"
    >
      <p className="font-medium group-hover:text-primary">{title} →</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}
