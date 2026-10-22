"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canOpenAdminPages } from "@/lib/org/access";
import { validateNewDepartment } from "@/lib/org/departments";
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
