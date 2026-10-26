import { redirect } from "next/navigation";
import { NoAccess } from "@/app/admin/no-access";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { loadDecisionRequests } from "@/lib/purchases/lists";
import { createClient } from "@/lib/supabase/server";
import { PurchaseList } from "../purchases/purchase-list";

// Список для рішення: заявки «Очікує схвалення» відділів, які переглядач схвалює, крім власних (AC-APR-01).
// Працівник з роллю requester бачить «Not enough permissions» і жодної заявки (AC-APR-04).
export default async function ApprovalsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "requester") return <NoAccess viewer={viewer} />;

  const { rows, departmentName } = await loadDecisionRequests(await createClient(), viewer.id);

  return (
    <PageShell viewer={viewer} title="Approvals" description="Requests awaiting your decision">
      <Card>
        {rows.length === 0 ? (
          <EmptyState>{MESSAGES.noDecisionRequests}</EmptyState>
        ) : (
          <PurchaseList rows={rows} departmentName={departmentName} testId="decision-list" />
        )}
      </Card>
    </PageShell>
  );
}
