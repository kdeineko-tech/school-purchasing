import Link from "next/link";
import { redirect } from "next/navigation";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";
import { NoAccess } from "../no-access";

// Налаштування відділів — лише для адміністратора (AC-ORG-09). Створення відділів — задача 2.1.
export default async function DepartmentsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess />;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Відділи</h1>
      <p className="text-sm text-zinc-500">Відділів ще немає.</p>
      <Link href="/admin" className="text-sm underline">
        До налаштувань
      </Link>
    </main>
  );
}
