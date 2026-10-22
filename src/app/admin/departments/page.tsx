import Link from "next/link";
import { redirect } from "next/navigation";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { createDepartment } from "../actions";
import { NoAccess } from "../no-access";

// Налаштування відділів — лише для адміністратора (AC-ORG-09); створення відділу (AC-ORG-34).
export default async function DepartmentsPage({ searchParams }: PageProps<"/admin/departments">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess />;

  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: departments } = await supabase.from("departments").select("id, name").order("name");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Відділи</h1>

      <form action={createDepartment} className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm text-zinc-500">
          Новий відділ
        </label>
        <div className="flex gap-2">
          <input
            id="name"
            name="name"
            required
            maxLength={100}
            className="flex-1 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="submit"
            className="rounded border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            Створити
          </button>
        </div>
        {typeof error === "string" && error && (
          <p role="alert" data-testid="department-error" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </form>

      {departments && departments.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm" data-testid="departments">
          {departments.map((d) => (
            <li key={d.id}>{d.name}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">Відділів ще немає.</p>
      )}

      <Link href="/admin" className="text-sm underline">
        До налаштувань
      </Link>
    </main>
  );
}
