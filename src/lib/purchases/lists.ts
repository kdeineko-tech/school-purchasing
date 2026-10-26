// Списки заявок для «My requests», «Approvals» і головної: ті самі запити в усіх трьох місцях, щоб головна
// не показувала більше чи інше, ніж повні списки. Клієнт Supabase — від переглядача (RLS діє).
import { decisionList } from "@/lib/purchases/decisions";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PurchaseRow = {
  id: string;
  department_id: string;
  purchase_type: string;
  status: string;
  created_at: string;
};

// total — скільки всього заявок у списку (рядків у rows може бути менше, якщо задано limit).
export type PurchaseListData = { rows: PurchaseRow[]; total: number; departmentName: Map<string, string> };

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
    await Promise.all([
      limit === undefined ? purchasesQuery : purchasesQuery.limit(limit),
      supabase.from("departments").select("id, name"),
    ]);
  const readError = purchasesError ?? departmentsError;
  if (readError) throw new Error(`Failed to read requests: ${readError.message}`);
  const rows = purchases ?? [];
  return { rows, total: count ?? rows.length, departmentName: new Map((departments ?? []).map((d) => [d.id, d.name])) };
}

// Список для рішення: «Очікує схвалення» відділів, які переглядач схвалює, крім власних, старіші першими (AC-APR-01).
export async function loadDecisionRequests(
  supabase: Supabase,
  viewerId: string,
  limit?: number,
): Promise<PurchaseListData> {
  const { data: approved, error: approvedError } = await supabase
    .from("department_members")
    .select("department_id")
    .eq("profile_id", viewerId)
    .eq("approves", true);
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
    await Promise.all([
      limit === undefined ? purchasesQuery : purchasesQuery.limit(limit),
      supabase.from("departments").select("id, name"),
    ]);
  const readError = purchasesError ?? departmentsError;
  if (readError) throw new Error(`Failed to read requests for decision: ${readError.message}`);

  const rows = decisionList(
    (purchases ?? []).map((p) => ({ ...p, authorId: p.author_id, departmentId: p.department_id })),
    viewerId,
    approvedDepartmentIds,
  );
  return { rows, total: count ?? rows.length, departmentName: new Map((departments ?? []).map((d) => [d.id, d.name])) };
}
