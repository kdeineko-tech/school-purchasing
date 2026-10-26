import Link from "next/link";
import { redirect } from "next/navigation";
import { NoAccess } from "@/app/admin/no-access";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { decisionList } from "@/lib/purchases/decisions";
import { formatSubmittedAt, PURCHASE_TYPE_LABELS, type PurchaseTypeId } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "../purchases/status-badge";

// Список для рішення: заявки «Очікує схвалення» відділів, які переглядач схвалює, крім власних (AC-APR-01).
// Працівник з роллю requester бачить «Not enough permissions» і жодної заявки (AC-APR-04).
export default async function ApprovalsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (viewer.role === "requester") return <NoAccess viewer={viewer} />;

  const supabase = await createClient();
  const { data: approved, error: approvedError } = await supabase
    .from("department_members")
    .select("department_id")
    .eq("profile_id", viewer.id)
    .eq("approves", true);
  if (approvedError) throw new Error(`Failed to read approved departments: ${approvedError.message}`);
  const approvedDepartmentIds = (approved ?? []).map((r) => r.department_id);

  let rows: { id: string; author_id: string; department_id: string; purchase_type: string; status: string; created_at: string }[] = [];
  let departmentName = new Map<string, string>();
  if (approvedDepartmentIds.length > 0) {
    const [{ data: purchases, error: purchasesError }, { data: departments, error: departmentsError }] =
      await Promise.all([
        supabase
          .from("purchases")
          .select("id, author_id, department_id, purchase_type, status, created_at")
          .in("department_id", approvedDepartmentIds)
          .eq("status", "awaiting_approval")
          .neq("author_id", viewer.id)
          .order("created_at"),
        supabase.from("departments").select("id, name"),
      ]);
    const readError = purchasesError ?? departmentsError;
    if (readError) throw new Error(`Failed to read requests for decision: ${readError.message}`);
    rows = purchases ?? [];
    departmentName = new Map((departments ?? []).map((d) => [d.id, d.name]));
  }

  const list = decisionList(
    rows.map((p) => ({ ...p, authorId: p.author_id, departmentId: p.department_id })),
    viewer.id,
    approvedDepartmentIds,
  );

  return (
    <PageShell viewer={viewer} title="Approvals" description="Requests awaiting your decision">
      <Card>
        {list.length === 0 ? (
          <EmptyState>{MESSAGES.noDecisionRequests}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="decision-list">
            {list.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/purchases/${p.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm hover:text-accent"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{departmentName.get(p.department_id) ?? "—"}</span>
                    <span className="text-muted">
                      {PURCHASE_TYPE_LABELS[p.purchase_type as PurchaseTypeId] ?? p.purchase_type} ·{" "}
                      {formatSubmittedAt(p.created_at)}
                    </span>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageShell>
  );
}
