// Відділи й типи для форми закупівлі з бази: їх однаково рахують сторінка форми й server action подання.
import { permissionsFromRow } from "@/lib/org/permissions";
import type { ViewerProfile } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { formDepartments, formPurchaseTypes, type FormOptions } from "./form";

export async function loadFormOptions(viewer: ViewerProfile): Promise<FormOptions> {
  const supabase = await createClient();
  // RLS: назви відділів бачать усі активні; рядки department_members і дозволи — лише власні.
  const [
    { data: departments, error: departmentsError },
    { data: rows, error: membersError },
    { data: own, error: ownError },
  ] = await Promise.all([
    supabase.from("departments").select("id, name"),
    supabase.from("department_members").select("profile_id, department_id").eq("profile_id", viewer.id),
    supabase
      .from("profiles")
      .select("can_card_expense, can_check_request, can_vendor_invoice, can_self_purchase")
      .eq("id", viewer.id)
      .single(),
  ]);
  // Помилку бази не видаємо за «немає відділів».
  const readError = departmentsError ?? membersError ?? ownError;
  if (readError || !own) throw new Error(`Failed to read purchase form options: ${readError?.message ?? "no data"}`);

  const memberships = (rows ?? []).map((r) => ({ profileId: r.profile_id, departmentId: r.department_id }));
  return {
    departments: formDepartments(viewer, memberships, departments ?? []),
    purchaseTypes: formPurchaseTypes({ ...permissionsFromRow(own), role: viewer.role }),
  };
}
