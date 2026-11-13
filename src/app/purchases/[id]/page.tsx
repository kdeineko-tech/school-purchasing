import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { NoAccess } from "@/app/admin/no-access";
import { PageShell } from "@/components/page-shell";
import { Alert, Card, Input, Notice } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { canDecide, canEditReturned } from "@/lib/purchases/decisions";
import { formatNumber } from "@/lib/purchases/amounts";
import { loadHistory } from "@/lib/purchases/history";
import { loadAuthorNames } from "@/lib/purchases/lists";
import {
  canSeePurchase,
  formatSubmittedAt,
  MAX_TEXT_LENGTH,
  PURCHASE_TYPE_LABELS,
  type PurchaseTypeId,
} from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { decidePurchase } from "../actions";
import { DecisionButtons } from "./decision-buttons";
import { HistoryCard } from "./history-card";
import { LinesCard, type PurchaseLine } from "./lines-card";
import { StatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Purchase" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Куди «назад»: автор відкриває свою заявку з «My requests», а схвалювач чи адміністратор чужу — зі списку для
// рішення (сторінка Approvals чи картка на головній).
function backLink(viewerId: string, authorId: string) {
  return viewerId === authorId ? { href: "/purchases", label: "My requests" } : { href: "/approvals", label: "Approvals" };
}

// Сторінка закупівлі: її бачать автор, схвалювач її відділу й адміністратор; іншим — «Not enough permissions» без
// даних закупівлі (AC-FRM-08). RLS не повертає чужу закупівлю, тож «немає» й «чужа» виглядають однаково й нічого не
// розкривають. Статус — текстом (AC-LANG-06). Схвалювач відділу, не автор, вирішує заявку «Очікує схвалення»
// (AC-APR-02, AC-APR-05, AC-APR-06); причину відхилення видно поруч зі статусом «Rejected» (AC-APR-07). Автор — ім'я,
// без імені — email, без інших даних профілю (AC-APR-08, AC-APR-09, AC-APR-10). Номер «PUR-…» (AC-HIST-01), сума
// кожного рядка й сума заявки за всіма рядками (AC-HIST-02). Історія — записи «Submitted · <ім'я> · <дата, час>»
// (AC-HIST-06); чужу заявку з історією сторінка не показує взагалі (AC-HIST-10). Часткове схвалення (AC-DEC-01):
// схвалювач позначає «Reject line» і схвалює; після рішення кожен рядок має статус «Approved» / «Rejected».
// Повернення (AC-DEC-04, AC-DEC-06): «Return for revision» з причиною; причину видно поруч зі статусом «Returned for
// revision», а автор бачить «Edit» — сторінку повторного подання (AC-DEC-07).
type PurchaseDetails = {
  id: string;
  author_id: string;
  department_id: string;
  purchase_type: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  number?: number | null;
  return_reason?: string | null;
};
const DETAILS = "id, author_id, department_id, purchase_type, status, rejection_reason, created_at";
// Поки міграцію номера, статусу рядка чи причини повернення не застосовано (Postgres — 42703), читаємо без цих колонок:
// «—» замість помилки.
const MISSING_COLUMN = "42703";
const DECISION_FORM = "decision-form";
const LINE_COLUMNS = "id, position, name, purpose, quantity, unit_price";

export default async function PurchasePage({ params, searchParams }: PageProps<"/purchases/[id]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { id } = await params;
  // Показуємо лише власні повідомлення застосунку, а не довільний текст з адреси.
  const { error, decided } = await searchParams;
  const known: string[] = Object.values(MESSAGES);
  const errorMessage = typeof error === "string" && known.includes(error) ? error : null;
  if (!UUID.test(id)) return <NoAccess viewer={viewer} />;

  const supabase = await createClient();
  const [
    { data: purchase, error: purchaseError },
    { data: lines, error: linesError },
    { data: approved, error: approvedError },
  ] = await Promise.all([
    readDetails(supabase, id),
    readLines(supabase, id),
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

  const [{ data: department, error: departmentError }, authorName, history] = await Promise.all([
    supabase.from("departments").select("name").eq("id", purchase.department_id).maybeSingle(),
    loadAuthorNames(supabase, [purchase.id]),
    loadHistory(supabase, purchase.id),
  ]);
  // Помилку бази не видаємо за «немає відділу».
  if (departmentError) throw new Error(`Failed to read department: ${departmentError.message}`);

  // Підтвердження після рішення — лише якщо заявка справді в цьому статусі (не довіряємо самій адресі).
  const DECIDED: Record<string, Record<string, string>> = {
    approve: { approved: "Request approved", partially_approved: "Request partially approved" },
    reject: { rejected: "Request rejected" },
    return: { returned: "Request returned for revision" },
  };
  const decidedNotice = (typeof decided === "string" && DECIDED[decided]?.[purchase.status]) || null;

  const decidable = canDecide(
    viewer,
    { authorId: purchase.author_id, departmentId: purchase.department_id, status: purchase.status },
    approvedDepartmentIds,
  );
  const editable = canEditReturned(viewer, { authorId: purchase.author_id, status: purchase.status });

  return (
    <PageShell viewer={viewer} title="Purchase" back={backLink(viewer.id, purchase.author_id)}>
      {errorMessage && <Alert testId="decision-error">{errorMessage}</Alert>}
      {decidedNotice && <Notice testId="decision-done">{decidedNotice}</Notice>}
      <Card>
        <dl className="grid grid-cols-[max-content_1fr] items-center gap-x-6 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Number</dt>
          <dd className="font-medium tabular-nums" data-testid="purchase-number">
            {formatNumber(purchase.number)}
          </dd>
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
          {purchase.status === "returned" && purchase.return_reason && (
            <>
              <dt className="text-muted-foreground">Reason</dt>
              <dd data-testid="return-reason">{purchase.return_reason}</dd>
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
        {editable && (
          <Link
            href={`/purchases/${purchase.id}/edit`}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-testid="edit-purchase"
          >
            Edit
          </Link>
        )}
      </Card>
      <LinesCard lines={lines ?? []} decisionFormId={decidable ? DECISION_FORM : undefined} />
      <HistoryCard history={history} />
      {decidable && (
        <Card title="Decision">
          <form id={DECISION_FORM} action={decidePurchase} className="flex flex-col gap-3 text-sm" data-testid="decision-form">
            <input type="hidden" name="purchaseId" value={purchase.id} />
            <label className="flex flex-col gap-1.5 font-medium">
              Reason (required to reject or return for revision)
              <Input name="reason" maxLength={MAX_TEXT_LENGTH} />
            </label>
            <DecisionButtons formId={DECISION_FORM} />
          </form>
        </Card>
      )}
    </PageShell>
  );
}

async function readDetails(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const read = (columns: string) =>
    supabase.from("purchases").select(columns).eq("id", id).maybeSingle() as unknown as PromiseLike<{
      data: PurchaseDetails | null;
      error: { code: string; message: string } | null;
    }>;
  // Колонки з'являються по черзі (number — раніше, return_reason — пізніше): спершу без нової, потім без обох.
  const result = await read(`number, return_reason, ${DETAILS}`);
  if (result.error?.code !== MISSING_COLUMN) return result;
  const withNumber = await read(`number, ${DETAILS}`);
  return withNumber.error?.code === MISSING_COLUMN ? read(DETAILS) : withNumber;
}

async function readLines(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const read = (columns: string) =>
    supabase.from("purchase_lines").select(columns).eq("purchase_id", id).order("position") as unknown as PromiseLike<{
      data: PurchaseLine[] | null;
      error: { code: string; message: string } | null;
    }>;
  const result = await read(`${LINE_COLUMNS}, status`);
  return result.error?.code === MISSING_COLUMN ? read(LINE_COLUMNS) : result;
}
