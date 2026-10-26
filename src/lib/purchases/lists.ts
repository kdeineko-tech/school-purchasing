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

export type PurchaseListData = { rows: PurchaseRow[]; departmentName: Map<string, string> };

// Власні заявки, новіші першими (AC-FRM-10). RLS пропустила б і заявки відділів, які працівник схвалює,
// тож власні відбираємо явно.
export async function loadMyRequests(supabase: Supabase, viewerId: string): Promise<PurchaseListData> {
  const [{ data: purchases, error: purchasesError }, { data: departments, error: departmentsError }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, department_id, purchase_type, status, created_at")
      .eq("author_id", viewerId)
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("id, name"),
  ]);
  const readError = purchasesError ?? departmentsError;
  if (readError) throw new Error(`Failed to read requests: ${readError.message}`);
  return { rows: purchases ?? [], departmentName: new Map((departments ?? []).map((d) => [d.id, d.name])) };
}

// Список для рішення: «Очікує схвалення» відділів, які переглядач схвалює, крім власних, старіші першими (AC-APR-01).
export async function loadDecisionRequests(supabase: Supabase, viewerId: string): Promise<PurchaseListData> {
  const { data: approved, error: approvedError } = await supabase
    .from("department_members")
    .select("department_id")
    .eq("profile_id", viewerId)
    .eq("approves", true);
  if (approvedError) throw new Error(`Failed to read approved departments: ${approvedError.message}`);
  const approvedDepartmentIds = (approved ?? []).map((r) => r.department_id);
  if (approvedDepartmentIds.length === 0) return { rows: [], departmentName: new Map() };

  const [{ data: purchases, error: purchasesError }, { data: departments, error: departmentsError }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, author_id, department_id, purchase_type, status, created_at")
      .in("department_id", approvedDepartmentIds)
      .eq("status", "awaiting_approval")
      .neq("author_id", viewerId)
      .order("created_at"),
    supabase.from("departments").select("id, name"),
  ]);
  const readError = purchasesError ?? departmentsError;
  if (readError) throw new Error(`Failed to read requests for decision: ${readError.message}`);

  const rows = decisionList(
    (purchases ?? []).map((p) => ({ ...p, authorId: p.author_id, departmentId: p.department_id })),
    viewerId,
    approvedDepartmentIds,
  );
  return { rows, departmentName: new Map((departments ?? []).map((d) => [d.id, d.name])) };
}
