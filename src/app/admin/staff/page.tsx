import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Badge, Card, RoleBadge } from "@/components/ui";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { NoAccess } from "../no-access";

// Список працівників — лише для адміністратора (AC-ORG-09).
export default async function StaffPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess viewer={viewer} />;

  // RLS: адміністратор бачить усі профілі (profiles_select_own_or_admin).
  const supabase = await createClient();
  const { data: staff, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, is_active")
    .order("email");
  if (error) throw new Error(`Не вдалося прочитати працівників: ${error.message}`);

  return (
    <PageShell
      viewer={viewer}
      title="Працівники"
      description="Оберіть працівника, щоб керувати його відділами"
      back={{ href: "/admin", label: "Налаштування" }}
    >
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Працівник</th>
              <th className="px-5 py-3 font-medium">Роль</th>
              <th className="px-5 py-3 font-medium">Стан</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-5 py-3">
                  <Link href={`/admin/staff/${p.id}`} className="font-medium hover:text-accent">
                    {p.full_name ?? p.email ?? "—"}
                  </Link>
                  <p className="text-xs text-muted">{p.email ?? "—"}</p>
                </td>
                <td className="px-5 py-3">
                  <RoleBadge role={p.role} />
                </td>
                <td className="px-5 py-3">
                  {p.is_active ? <Badge>Активний</Badge> : <Badge tone="danger">Деактивований</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
