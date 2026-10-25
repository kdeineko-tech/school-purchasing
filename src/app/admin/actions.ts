"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canOpenAdminPages, type AppRole } from "@/lib/org/access";
import { leavesNoActiveAdmin } from "@/lib/org/admins";
import { validateNewDepartment } from "@/lib/org/departments";
import { setApprover as setApproverRule, setAutoApprove as setAutoApproveRule } from "@/lib/org/membership";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

// Дії адміністратора. Перше правило — доменна функція з повідомленням PM; база (RLS, унікальний індекс) —
// друга лінія захисту, і на її помилки показуємо те саме повідомлення.

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) redirect("/admin");
  return viewer;
}

// AC-ORG-34: відділ з назвою, що вже є (без урахування регістру), не створюємо.
export async function createDepartment(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "");

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase.from("departments").select("name");
  if (readError) throw new Error(`Не вдалося прочитати відділи: ${readError.message}`);

  const check = validateNewDepartment(name, (existing ?? []).map((d) => d.name));
  if (!check.ok) {
    redirect(`/admin/departments?error=${encodeURIComponent(check.error)}`);
  }

  const { error } = await supabase.from("departments").insert({ name: check.name });
  // Хтось створив таку саму назву між читанням і записом — спрацював унікальний індекс.
  if (error?.code === UNIQUE_VIOLATION) {
    redirect(`/admin/departments?error=${encodeURIComponent(MESSAGES.departmentExists)}`);
  }
  if (error) throw new Error(`Не вдалося створити відділ: ${error.message}`);

  revalidatePath("/admin/departments");
  redirect("/admin/departments");
}

// AC-ORG-01: адміністратор додає працівника до відділу як заявника.
export async function addRequester(formData: FormData) {
  await requireAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  if (!UUID.test(profileId) || !UUID.test(departmentId)) redirect("/admin/staff");

  const supabase = await createClient();
  const { error } = await supabase
    .from("department_members")
    .insert({ profile_id: profileId, department_id: departmentId });
  // Профіль чи відділ тим часом зник — повертаємо до списку працівників.
  if (error?.code === FOREIGN_KEY_VIOLATION) redirect("/admin/staff");
  // Уже заявник цього відділу — нічого не змінюємо.
  if (error && error.code !== UNIQUE_VIOLATION) {
    throw new Error(`Не вдалося додати заявника: ${error.message}`);
  }

  revalidatePath(`/admin/staff/${profileId}`);
  redirect(`/admin/staff/${profileId}`);
}

function readMemberIds(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  if (!UUID.test(profileId) || !UUID.test(departmentId)) redirect("/admin/staff");
  return { profileId, departmentId };
}

function backToStaff(profileId: string, error?: string): never {
  revalidatePath(`/admin/staff/${profileId}`);
  revalidatePath("/admin/departments");
  redirect(`/admin/staff/${profileId}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

// AC-ORG-02, AC-ORG-05, AC-ORG-19, AC-ORG-20: призначити схвалювачем можна лише заявника відділу;
// роль за відділами ставить тригер private.sync_role.
export async function setApprover(formData: FormData) {
  await requireAdmin();
  const { profileId, departmentId } = readMemberIds(formData);
  const approvesValue = formData.get("approves");
  // Лише явне «так» чи «ні»: інше значення не має мовчки знімати чинне схвалення.
  if (approvesValue !== "true" && approvesValue !== "false") backToStaff(profileId);
  const approves = approvesValue === "true";

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("department_members")
    .select("profile_id, department_id, approves")
    .eq("profile_id", profileId)
    .eq("department_id", departmentId)
    .maybeSingle();
  if (readError) throw new Error(`Не вдалося прочитати заявника: ${readError.message}`);

  const memberships = row ? [{ profileId: row.profile_id, departmentId: row.department_id, approves: row.approves }] : [];
  const change = setApproverRule(memberships, profileId, departmentId, approves);
  if (!change.ok) backToStaff(profileId, change.error);

  const { data: updated, error } = await supabase
    .from("department_members")
    .update({ approves })
    .eq("profile_id", profileId)
    .eq("department_id", departmentId)
    .select("profile_id");
  if (error) throw new Error(`Не вдалося змінити схвалювача: ${error.message}`);
  // Рядок заявника зник між читанням і записом — те саме правило AC-ORG-02.
  if (!updated || updated.length === 0) backToStaff(profileId, MESSAGES.addAsRequesterFirst);

  backToStaff(profileId);
}

// AC-ORG-12, AC-ORG-18: адміністратор деактивує й знову активує працівника; останнього активного адміністратора
// база не деактивує (тригер private.guard_last_admin, виняток LAST_ADMIN).
// AC-ORG-06, AC-ORG-33: автосхвалення вмикають лише заявнику відділу й лише для цього відділу.
export async function setAutoApprove(formData: FormData) {
  await requireAdmin();
  const { profileId, departmentId } = readMemberIds(formData);
  const value = formData.get("autoApprove");
  // Лише явне «так» чи «ні»: інше значення не має мовчки вимикати автосхвалення.
  if (value !== "true" && value !== "false") backToStaff(profileId);
  const autoApprove = value === "true";

  const supabase = await createClient();
  const { data: row, error: readError } = await supabase
    .from("department_members")
    .select("profile_id, department_id, auto_approve")
    .eq("profile_id", profileId)
    .eq("department_id", departmentId)
    .maybeSingle();
  if (readError) throw new Error(`Не вдалося прочитати заявника: ${readError.message}`);

  const memberships = row
    ? [{ profileId: row.profile_id, departmentId: row.department_id, autoApprove: row.auto_approve }]
    : [];
  const change = setAutoApproveRule(memberships, profileId, departmentId, autoApprove);
  if (!change.ok) backToStaff(profileId, change.error);

  const { data: updated, error } = await supabase
    .from("department_members")
    .update({ auto_approve: autoApprove })
    .eq("profile_id", profileId)
    .eq("department_id", departmentId)
    .select("profile_id");
  if (error) throw new Error(`Не вдалося змінити автосхвалення: ${error.message}`);
  // Рядок заявника зник між читанням і записом — те саме правило AC-ORG-33.
  if (!updated || updated.length === 0) backToStaff(profileId, MESSAGES.addAsRequesterFirst);

  backToStaff(profileId);
}

// AC-ORG-17, AC-ORG-26, AC-ORG-27: дозволи на типи заявок і «Самостійну закупівлю» видає й забирає адміністратор.
// Позначений прапорець — дозвіл є, знятий — дозволу немає (форма надсилає лише позначені).
export async function setPermissions(formData: FormData) {
  await requireAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  if (!UUID.test(profileId)) redirect("/admin/staff");

  const permissions = {
    can_card_expense: formData.get("can_card_expense") === "on",
    can_check_request: formData.get("can_check_request") === "on",
    can_vendor_invoice: formData.get("can_vendor_invoice") === "on",
    can_self_purchase: formData.get("can_self_purchase") === "on",
  };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(permissions).eq("id", profileId);
  if (error) throw new Error(`Не вдалося змінити дозволи: ${error.message}`);

  backToStaff(profileId);
}

export async function setActive(formData: FormData) {
  await requireAdmin();
  const profileId = String(formData.get("profileId") ?? "");
  const activeValue = formData.get("active");
  if (!UUID.test(profileId)) redirect("/admin/staff");
  if (activeValue !== "true" && activeValue !== "false") backToStaff(profileId);
  const active = activeValue === "true";

  const supabase = await createClient();
  const { data: staff, error: readError } = await supabase.from("profiles").select("id, role, is_active");
  if (readError) throw new Error(`Не вдалося прочитати працівників: ${readError.message}`);
  const state = (staff ?? []).map((p) => ({ id: p.id, role: p.role as AppRole, isActive: p.is_active }));
  if (!active && leavesNoActiveAdmin(state, profileId, active)) backToStaff(profileId, MESSAGES.lastAdmin);

  const { error } = await supabase.from("profiles").update({ is_active: active }).eq("id", profileId);
  if (error?.message.includes("LAST_ADMIN")) backToStaff(profileId, MESSAGES.lastAdmin);
  if (error) throw new Error(`Не вдалося змінити активність: ${error.message}`);

  revalidatePath("/admin/staff");
  backToStaff(profileId);
}

// AC-ORG-03, AC-ORG-24: зняття заявника прибирає й схвалення цього відділу; роль — тригер private.sync_role.
export async function removeRequester(formData: FormData) {
  await requireAdmin();
  const { profileId, departmentId } = readMemberIds(formData);

  const supabase = await createClient();
  const { error } = await supabase
    .from("department_members")
    .delete()
    .eq("profile_id", profileId)
    .eq("department_id", departmentId);
  if (error) throw new Error(`Не вдалося прибрати заявника: ${error.message}`);

  backToStaff(profileId);
}
