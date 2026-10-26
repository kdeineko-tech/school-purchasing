import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Card, RoleBadge } from "@/components/ui";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";

// Головна: хто увійшов і куди далі. Посилання «Налаштування» — за правилом доступу до /admin (AC-ORG-09).
export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  return (
    <PageShell viewer={viewer} title={`Welcome, ${viewer.fullName ?? viewer.email ?? ""}`}>
      <Card>
        <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted">Email</dt>
          <dd data-testid="user-email">{viewer.email ?? "—"}</dd>
          <dt className="text-muted">Role</dt>
          <dd data-testid="user-role">
            <RoleBadge role={viewer.role} />
          </dd>
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <NavCard href="/purchases/new" title="New purchase" text="Request items for your department" />
        <NavCard href="/purchases" title="My requests" text="Requests you have submitted and their status" />
        {viewer.role !== "requester" && (
          <NavCard href="/approvals" title="Approvals" text="Requests awaiting your decision" />
        )}
        <NavCard href="/profile" title="My profile" text="Departments where you submit requests" />
        {canOpenAdminPages(viewer) && (
          <NavCard href="/admin" title="Settings" text="School employees and departments" />
        )}
      </div>
    </PageShell>
  );
}

function NavCard({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-surface p-5 shadow-sm transition hover:border-accent"
    >
      <p className="font-medium group-hover:text-accent">{title} →</p>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </Link>
  );
}
