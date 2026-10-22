import Link from "next/link";
import { redirect } from "next/navigation";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { NoAccess } from "../no-access";

// Список працівників — лише для адміністратора (AC-ORG-09).
export default async function StaffPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess />;

  // RLS: адміністратор бачить усі профілі (profiles_select_own_or_admin).
  const supabase = await createClient();
  const { data: staff } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .order("email");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Працівники</h1>
      <table className="w-full text-left text-sm">
        <thead className="text-zinc-500">
          <tr>
            <th className="py-1">Працівник</th>
            <th className="py-1">Email</th>
            <th className="py-1">Роль</th>
            <th className="py-1">Активний</th>
          </tr>
        </thead>
        <tbody>
          {(staff ?? []).map((p) => (
            <tr key={p.id} className="border-t border-zinc-200 dark:border-zinc-800">
              <td className="py-1">
                <Link href={`/admin/staff/${p.id}`} className="underline">
                  {p.full_name ?? p.email ?? "—"}
                </Link>
              </td>
              <td className="py-1">{p.email ?? "—"}</td>
              <td className="py-1">{p.role}</td>
              <td className="py-1">{p.is_active ? "так" : "ні"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Link href="/admin" className="text-sm underline">
        До налаштувань
      </Link>
    </main>
  );
}
