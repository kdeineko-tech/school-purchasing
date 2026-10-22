import Link from "next/link";
import { redirect } from "next/navigation";
import { requesterDepartments } from "@/lib/org/membership";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

// Власний профіль: заявник і схвалювач бачать свої відділи, змінювати їх не можуть (вимога
// ValiaBihun/2026-quitcode-dream-team#2, «Користувачі й ролі»; AC-ORG-01).
export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const supabase = await createClient();
  // RLS: працівник бачить лише власні рядки department_members.
  const [{ data: departments, error: departmentsError }, { data: rows, error: membersError }] =
    await Promise.all([
      supabase.from("departments").select("id, name"),
      supabase.from("department_members").select("profile_id, department_id").eq("profile_id", viewer.id),
    ]);
  // Помилку бази не видаємо за «Немає».
  const readError = departmentsError ?? membersError;
  if (readError) throw new Error(`Не вдалося прочитати відділи: ${readError.message}`);
  const memberships = (rows ?? []).map((r) => ({ profileId: r.profile_id, departmentId: r.department_id }));
  const mine = requesterDepartments(memberships, departments ?? [], viewer.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Мій профіль</h1>
      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Відділи, де я подаю заявки</h2>
        {mine.length > 0 ? (
          <ul className="text-sm" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Немає.</p>
        )}
      </section>
      <Link href="/" className="text-sm underline">
        На головну
      </Link>
    </main>
  );
}
