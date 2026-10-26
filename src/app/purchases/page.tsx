import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Card, EmptyState, Notice } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { formatSubmittedAt, PURCHASE_TYPE_LABELS, type PurchaseTypeId } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "./status-badge";

// «Мої заявки»: лише власні заявки зі статусом текстом (AC-FRM-10, AC-LANG-06); після подання —
// «Purchase submitted» (AC-FRM-11). Без жодної поданої заявки — «You have not submitted any requests yet» замість
// списку (AC-FRM-14; відповідь PM ValiaBihun/2026-quitcode-dream-team#58).
export default async function MyRequestsPage({ searchParams }: PageProps<"/purchases">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { submitted } = await searchParams;

  const supabase = await createClient();
  // RLS пропустила б і заявки відділів, які працівник схвалює, тож власні відбираємо явно.
  const [{ data: purchases, error: purchasesError }, { data: departments, error: departmentsError }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, department_id, purchase_type, status, created_at")
      .eq("author_id", viewer.id)
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name"),
  ]);
  const readError = purchasesError ?? departmentsError;
  if (readError) throw new Error(`Failed to read requests: ${readError.message}`);
  const departmentName = new Map((departments ?? []).map((d) => [d.id, d.name]));

  return (
    <PageShell viewer={viewer} title="My requests">
      {submitted === "1" && <Notice testId="submitted">{MESSAGES.purchaseSubmitted}</Notice>}
      <div>
        <Link
          href="/purchases/new"
          className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          New purchase
        </Link>
      </div>
      <Card>
        {(purchases ?? []).length === 0 ? (
          <EmptyState>{MESSAGES.noRequests}</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-border" data-testid="my-requests">
            {(purchases ?? []).map((p) => (
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
