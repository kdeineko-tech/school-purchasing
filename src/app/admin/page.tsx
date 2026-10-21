import Link from "next/link";
import { redirect } from "next/navigation";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";
import { NoAccess } from "./no-access";

// Налаштування школи — лише для адміністратора (AC-ORG-09).
export default async function AdminHome() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess />;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold">Налаштування</h1>
      <ul className="flex flex-col gap-2 text-sm underline">
        <li>
          <Link href="/admin/staff">Працівники</Link>
        </li>
        <li>
          <Link href="/admin/departments">Відділи</Link>
        </li>
      </ul>
      <Link href="/" className="text-sm underline">
        На головну
      </Link>
    </main>
  );
}
