// Списки заявок для «My requests», «Approvals» і головної: ті самі запити в усіх трьох місцях, щоб головна
// не показувала більше чи інше, ніж повні списки. Клієнт Supabase — від переглядача (RLS діє).
import { decisionList } from "@/lib/purchases/decisions";
import type { createClient } from "@/lib/supabase/server";
import { timed } from "@/lib/timing";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PurchaseRow = {
  id: string;
  department_id: string;
  purchase_type: string;
  status: string;
  created_at: string;
};

// total — скільки всього заявок у списку (рядків у rows може бути менше, якщо задано limit).
// authorName — лише у списку для рішення: ім'я автора кожної заявки, без імені — email (AC-APR-08, AC-APR-09).
export type PurchaseListData = {
  rows: PurchaseRow[];
  total: number;
  departmentName: Map<string, string>;
  authorName?: Map<string, string>;
};

// Ім'я автора для заявок, які переглядач і так бачить: функція бази public.purchase_author_names віддає лише ім'я
// (без імені — email), без інших даних профілю (AC-APR-10; міграція 20261026155141_purchase_author_names.sql).
// Vercel викладає код одразу після merge, а міграцію застосовує db-deploy у CI трохи пізніше; прев'ю PR працює з
// тією самою базою ще до merge. Поки функції в базі немає (PostgREST — PGRST202, Postgres — 42883), сторінки
// показують «Author: —» замість помилки. Будь-яку іншу помилку бази не ховаємо.
const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

export async function loadAuthorNames(supabase: Supabase, purchaseIds: string[]): Promise<Map<string, string>> {
  if (purchaseIds.length === 0) return new Map();
  const { data, error } = await timed("author-names", async () =>
    supabase.rpc("purchase_author_names", { p_purchase_ids: purchaseIds }),
  );
  if (error && MISSING_FUNCTION.has(error.code)) return new Map();
  if (error) throw new Error(`Failed to read request authors: ${error.message}`);
  return new Map((data ?? []).map((r) => [r.purchase_id, r.author_name]));
}

// limit — лише для головної (кілька перших рядків); повні списки читаються без нього. Кількість рахує база
// (count: "exact"), тож вона правильна й тоді, коли заявок більше, ніж Supabase віддає за раз.

// Власні заявки, новіші першими (AC-FRM-10). RLS пропустила б і заявки відділів, які працівник схвалює,
// тож власні відбираємо явно.
export async function loadMyRequests(supabase: Supabase, viewerId: string, limit?: number): Promise<PurchaseListData> {
  const purchasesQuery = supabase
    .from("purchases")
    .select("id, department_id, purchase_type, status, created_at", { count: "exact" })
    .eq("author_id", viewerId)
    .order("created_at", { ascending: false });
  const [{ data: purchases, count, error: purchasesError }, { data: departments, error: departmentsError }] =
    await timed("my-requests", async () =>
      Promise.all([
        limit === undefined ? purchasesQuery : purchasesQuery.limit(limit),
        supabase.from("departments").select("id, name"),
      ]),
    );
  const readError = purchasesError ?? departmentsError;
  if (readError) throw new Error(`Failed to read requests: ${readError.message}`);
  const rows = purchases ?? [];
  return { rows, total: count ?? rows.length, departmentName: new Map((departments ?? []).map((d) => [d.id, d.name])) };
}

// Скільки власних заявок ще чекає рішення — лічильник біля «My recent requests» на головній. Рядків не читаємо,
// лише кількість (head: true).
export async function countMyAwaiting(supabase: Supabase, viewerId: string): Promise<number> {
  const { count, error } = await timed("count-awaiting", async () =>
    supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("author_id", viewerId)
      .eq("status", "awaiting_approval"),
  );
  if (error) throw new Error(`Failed to count requests: ${error.message}`);
  return count ?? 0;
}

// Список для рішення: «Очікує схвалення» відділів, які переглядач схвалює, крім власних, старіші першими (AC-APR-01).
export async function loadDecisionRequests(
  supabase: Supabase,
  viewerId: string,
  limit?: number,
): Promise<PurchaseListData> {
  const { data: approved, error: approvedError } = await timed("approved-departments", async () =>
    supabase.from("department_members").select("department_id").eq("profile_id", viewerId).eq("approves", true),
  );
  if (approvedError) throw new Error(`Failed to read approved departments: ${approvedError.message}`);
  const approvedDepartmentIds = (approved ?? []).map((r) => r.department_id);
  if (approvedDepartmentIds.length === 0) return { rows: [], total: 0, departmentName: new Map() };

  // Фільтри запиту — ті самі умови, що й decisionList, тож count бази дорівнює довжині повного списку.
  const purchasesQuery = supabase
    .from("purchases")
    .select("id, author_id, department_id, purchase_type, status, created_at", { count: "exact" })
    .in("department_id", approvedDepartmentIds)
    .eq("status", "awaiting_approval")
    .neq("author_id", viewerId)
    .order("created_at", { ascending: true });
  const [{ data: purchases, count, error: purchasesError }, { data: departments, error: departmentsError }] =
    await timed("decision-list", async () =>
      Promise.all([
        limit === undefined ? purchasesQuery : purchasesQuery.limit(limit),
        supabase.from("departments").select("id, name"),
      ]),
    );
  const readError = purchasesError ?? departmentsError;
  if (readError) throw new Error(`Failed to read requests for decision: ${readError.message}`);

  const rows = decisionList(
    (purchases ?? []).map((p) => ({ ...p, authorId: p.author_id, departmentId: p.department_id })),
    viewerId,
    approvedDepartmentIds,
  );
  return {
    rows,
    total: count ?? rows.length,
    departmentName: new Map((departments ?? []).map((d) => [d.id, d.name])),
    authorName: await loadAuthorNames(
      supabase,
      rows.map((r) => r.id),
    ),
  };
}
