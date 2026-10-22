import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canOpenAdminPages } from "@/lib/org/access";
import { requesterDepartments } from "@/lib/org/membership";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { addRequester } from "../../actions";
import { NoAccess } from "../../no-access";

// Профіль працівника для адміністратора (AC-ORG-09): відділи, де він подає заявки (AC-ORG-01).
export default async function StaffProfilePage({ params }: PageProps<"/admin/staff/[id]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess />;

  const { id } = await params;
  const supabase = await createClient();
  const [
    { data: profile, error: profileError },
    { data: departments, error: departmentsError },
    { data: rows, error: membershipsError },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, is_active").eq("id", id).maybeSingle(),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("department_members").select("profile_id, department_id").eq("profile_id", id),
  ]);
  // Помилку бази не видаємо за «профілю немає» чи «відділів немає».
  const readError = profileError ?? departmentsError ?? membershipsError;
  if (readError) throw new Error(`Не вдалося прочитати профіль працівника: ${readError.message}`);
  if (!profile) notFound();

  const memberships = (rows ?? []).map((r) => ({ profileId: r.profile_id, departmentId: r.department_id }));
  const mine = requesterDepartments(memberships, departments ?? [], id);
  const others = (departments ?? []).filter((d) => !mine.some((m) => m.id === d.id));

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">{profile.full_name ?? profile.email}</h1>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-zinc-500">Email</dt>
        <dd>{profile.email ?? "—"}</dd>
        <dt className="text-zinc-500">Роль</dt>
        <dd>{profile.role}</dd>
        <dt className="text-zinc-500">Активний</dt>
        <dd>{profile.is_active ? "так" : "ні"}</dd>
      </dl>

      <section className="flex flex-col gap-2">
        <h2 className="font-medium">Відділи, де подає заявки</h2>
        {mine.length > 0 ? (
          <ul className="text-sm" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id}>{d.name}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">Немає.</p>
        )}

        {others.length > 0 && (
          <form action={addRequester} className="flex gap-2">
            <input type="hidden" name="profileId" value={profile.id} />
            <select
              name="departmentId"
              required
              aria-label="Відділ"
              className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
            >
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              Додати як заявника
            </button>
          </form>
        )}
      </section>

      <Link href="/admin/staff" className="text-sm underline">
        До працівників
      </Link>
    </main>
  );
}
