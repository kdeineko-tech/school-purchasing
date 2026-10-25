import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Badge, Card, Notice } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { PURCHASE_TYPE_LABELS, STATUS_LABELS, type PurchaseStatus, type PurchaseTypeId } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";

// Дати й час — за часом America/New_York («Припущення» вимоги ValiaBihun/2026-quitcode-dream-team#47).
const SUBMITTED_AT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/New_York",
  dateStyle: "short",
  timeStyle: "short",
});

const STATUS_TONE: Record<PurchaseStatus, "neutral" | "accent" | "danger"> = {
  awaiting_approval: "neutral",
  approved: "accent",
  rejected: "danger",
};

// «Мої заявки»: лише власні заявки зі статусом текстом (AC-FRM-10, AC-LANG-06); після подання —
// «Purchase submitted» (AC-FRM-11). Порожній список — без окремого тексту до відповіді PM на Q6
// (ValiaBihun/2026-quitcode-dream-team#58).
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
        <ul className="flex flex-col divide-y divide-border" data-testid="my-requests">
          {(purchases ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div className="flex flex-col">
                <span className="font-medium">{departmentName.get(p.department_id) ?? "—"}</span>
                <span className="text-muted">
                  {PURCHASE_TYPE_LABELS[p.purchase_type as PurchaseTypeId] ?? p.purchase_type} ·{" "}
                  {SUBMITTED_AT.format(new Date(p.created_at))}
                </span>
              </div>
              <Badge tone={STATUS_TONE[p.status as PurchaseStatus] ?? "neutral"}>
                {STATUS_LABELS[p.status as PurchaseStatus] ?? p.status}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </PageShell>
  );
}
