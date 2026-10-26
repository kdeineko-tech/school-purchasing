import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { Badge, Card, EmptyState, roleLabel } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { loadDecisionRequests, loadMyRequests } from "@/lib/purchases/lists";
import { createClient } from "@/lib/supabase/server";
import { PurchaseList } from "./purchases/purchase-list";

// Скільки рядків у картках головної; повні списки — «Approvals» і «My requests».
const DASHBOARD_ROWS = 5;

// Головна — робоча панель: одна основна дія «New purchase», заявки, що чекають рішення переглядача (лише для
// схвалювача й адміністратора, як і сторінка «Approvals», AC-APR-01, AC-APR-04), і останні власні заявки
// (AC-FRM-10). Дані — тими самими запитами, що й повні списки (src/lib/purchases/lists.ts).
export default async function Home() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const supabase = await createClient();
  const decides = viewer.role !== "requester";
  const [mine, decision] = await Promise.all([
    loadMyRequests(supabase, viewer.id, DASHBOARD_ROWS),
    decides ? loadDecisionRequests(supabase, viewer.id, DASHBOARD_ROWS) : null,
  ]);

  return (
    <PageShell
      viewer={viewer}
      title={`Welcome, ${viewer.fullName ?? viewer.email ?? ""}`}
      description={[roleLabel(viewer.role), viewer.email].filter(Boolean).join(" · ")}
    >
      <div>
        <Link
          href="/purchases/new"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
        >
          <Plus className="size-4" aria-hidden />
          New purchase
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {decision && (
          <DashboardCard
            title="Awaiting your decision"
            count={decision.total}
            href="/approvals"
            linkText="All approvals"
            testId="dashboard-decisions"
          >
            {decision.rows.length === 0 ? (
              <EmptyState>{MESSAGES.noDecisionRequests}</EmptyState>
            ) : (
              <PurchaseList
                rows={decision.rows}
                departmentName={decision.departmentName}
                testId="decision-list"
              />
            )}
          </DashboardCard>
        )}
        <DashboardCard
          title="My recent requests"
          href="/purchases"
          linkText="All requests"
          testId="dashboard-mine"
          wide={!decision}
        >
          {mine.rows.length === 0 ? (
            <EmptyState>{MESSAGES.noRequests}</EmptyState>
          ) : (
            <PurchaseList
              rows={mine.rows}
              departmentName={mine.departmentName}
              testId="my-requests"
            />
          )}
        </DashboardCard>
      </div>
    </PageShell>
  );
}

function DashboardCard({
  title,
  count,
  href,
  linkText,
  testId,
  wide,
  children,
}: {
  title: string;
  count?: number;
  href: string;
  linkText: string;
  testId: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className={wide ? "md:col-span-2" : undefined}>
      <div data-testid={testId} className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">{title}</h2>
          {count !== undefined && count > 0 && <Badge tone="pending">{count}</Badge>}
        </div>
        {children}
        <Link href={href} className="self-start text-sm font-medium text-primary hover:underline">
          {linkText} →
        </Link>
      </div>
    </Card>
  );
}
