import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState, Notice } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { loadMyRequests } from "@/lib/purchases/lists";
import { createClient } from "@/lib/supabase/server";
import { PurchaseList } from "./purchase-list";

export const metadata: Metadata = { title: "My requests" };

// «Мої заявки»: лише власні заявки зі статусом текстом (AC-FRM-10, AC-LANG-06); після подання —
// «Purchase submitted» (AC-FRM-11). Без жодної поданої заявки — «You have not submitted any requests yet» замість
// списку (AC-FRM-14; відповідь PM ValiaBihun/2026-quitcode-dream-team#58).
export default async function MyRequestsPage({ searchParams }: PageProps<"/purchases">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { submitted } = await searchParams;

  const { rows, departmentName } = await loadMyRequests(await createClient(), viewer.id);

  return (
    <PageShell viewer={viewer} title="My requests">
      {submitted === "1" && <Notice testId="submitted">{MESSAGES.purchaseSubmitted}</Notice>}
      <div>
        <Link
          href="/purchases/new"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New purchase
        </Link>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState>{MESSAGES.noRequests}</EmptyState>
        ) : (
          <PurchaseList rows={rows} departmentName={departmentName} testId="my-requests" />
        )}
      </Card>
    </PageShell>
  );
}
