import { redirect } from "next/navigation";
import { NoAccess } from "@/app/admin/no-access";
import { PageShell } from "@/components/page-shell";
import { Alert, Button, Card, Input } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { canDecide } from "@/lib/purchases/decisions";
import { loadAuthorNames } from "@/lib/purchases/lists";
import {
  canSeePurchase,
  formatSubmittedAt,
  PURCHASE_TYPE_LABELS,
  type PurchaseTypeId,
} from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { decidePurchase } from "../actions";
import { StatusBadge } from "../status-badge";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const price = (value: number | null) => (value === null ? "—" : Number(value).toFixed(2));

// Сторінка закупівлі: її бачать автор, схвалювач її відділу й адміністратор; іншим — «Not enough permissions» без
// даних закупівлі (AC-FRM-08). RLS не повертає чужу закупівлю, тож «немає» й «чужа» виглядають однаково й нічого не
// розкривають. Статус — текстом (AC-LANG-06). Схвалювач відділу, не автор, вирішує заявку «Очікує схвалення»
// (AC-APR-02, AC-APR-05, AC-APR-06); причину відхилення видно поруч зі статусом «Rejected» (AC-APR-07). Автор — ім'я,
// без імені — email, без інших даних профілю (AC-APR-08, AC-APR-09, AC-APR-10).
export default async function PurchasePage({ params, searchParams }: PageProps<"/purchases/[id]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  // Показуємо лише власні повідомлення застосунку, а не довільний текст з адреси.
  const { error } = await searchParams;
  const known: string[] = Object.values(MESSAGES);
  const errorMessage = typeof error === "string" && known.includes(error) ? error : null;
  if (!UUID.test(id)) return <NoAccess viewer={viewer} />;

  const supabase = await createClient();
  const [
    { data: purchase, error: purchaseError },
    { data: lines, error: linesError },
    { data: approved, error: approvedError },
  ] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, author_id, department_id, purchase_type, status, rejection_reason, created_at")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("purchase_lines")
      .select("position, name, purpose, quantity, unit_price")
      .eq("purchase_id", id)
      .order("position"),
    supabase.from("department_members").select("department_id").eq("profile_id", viewer.id).eq("approves", true),
  ]);
  const readError = purchaseError ?? linesError ?? approvedError;
  if (readError) throw new Error(`Failed to read purchase: ${readError.message}`);

  const approvedDepartmentIds = (approved ?? []).map((r) => r.department_id);
  if (
    !purchase ||
    !canSeePurchase(viewer, { authorId: purchase.author_id, departmentId: purchase.department_id }, approvedDepartmentIds)
  ) {
    return <NoAccess viewer={viewer} />;
  }

  const [{ data: department, error: departmentError }, authorName] = await Promise.all([
    supabase.from("departments").select("name").eq("id", purchase.department_id).maybeSingle(),
    loadAuthorNames(supabase, [purchase.id]),
  ]);
  // Помилку бази не видаємо за «немає відділу».
  if (departmentError) throw new Error(`Failed to read department: ${departmentError.message}`);

  const decidable = canDecide(
    viewer,
    { authorId: purchase.author_id, departmentId: purchase.department_id, status: purchase.status },
    approvedDepartmentIds,
  );

  return (
    <PageShell viewer={viewer} title="Purchase" back={{ href: "/purchases", label: "My requests" }}>
      {errorMessage && <Alert testId="decision-error">{errorMessage}</Alert>}
      <Card>
        <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge status={purchase.status} />
          </dd>
          {purchase.status === "rejected" && purchase.rejection_reason && (
            <>
              <dt className="text-muted-foreground">Reason</dt>
              <dd data-testid="rejection-reason">{purchase.rejection_reason}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Author</dt>
          <dd data-testid="purchase-author">{authorName.get(purchase.id) ?? "—"}</dd>
          <dt className="text-muted-foreground">Department</dt>
          <dd data-testid="purchase-department">{department?.name ?? "—"}</dd>
          <dt className="text-muted-foreground">Purchase type</dt>
          <dd>{PURCHASE_TYPE_LABELS[purchase.purchase_type as PurchaseTypeId] ?? purchase.purchase_type}</dd>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{formatSubmittedAt(purchase.created_at)}</dd>
        </dl>
      </Card>
      <Card title="Lines">
        <table aria-label="Lines" className="w-full text-left text-sm" data-testid="purchase-lines">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium">Purpose</th>
              <th className="py-2 text-right font-medium">Quantity</th>
              <th className="py-2 text-right font-medium">Unit price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(lines ?? []).map((line) => (
              <tr key={line.position}>
                <td className="py-2">{line.name ?? "—"}</td>
                <td className="py-2">{line.purpose ?? "—"}</td>
                <td className="py-2 text-right">{line.quantity ?? "—"}</td>
                <td className="py-2 text-right">{price(line.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {decidable && (
        <Card title="Decision">
          <form action={decidePurchase} className="flex flex-col gap-3 text-sm" data-testid="decision-form">
            <input type="hidden" name="purchaseId" value={purchase.id} />
            <label className="flex flex-col gap-1.5 font-medium">
              Reason (required to reject)
              <Input name="reason" maxLength={500} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" name="decision" value="approve">
                Approve
              </Button>
              <Button type="submit" name="decision" value="reject" variant="destructive">
                Reject
              </Button>
            </div>
          </form>
        </Card>
      )}
    </PageShell>
  );
}
