import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Badge, Card, RoleBadge } from "@/components/ui";
import { canOpenAdminPages } from "@/lib/org/access";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { NoAccess } from "../no-access";

export const metadata: Metadata = { title: "Employees" };

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
  if (error) throw new Error(`Failed to read employees: ${error.message}`);

  return (
    <PageShell
      viewer={viewer}
      title="Employees"
      description="Choose an employee to manage their departments"
      back={{ href: "/admin", label: "Settings" }}
    >
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-5 py-3">
                  <Link href={`/admin/staff/${p.id}`} className="font-medium hover:text-primary">
                    {p.full_name ?? p.email ?? "—"}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.email ?? "—"}</p>
                </td>
                <td className="px-5 py-3">
                  <RoleBadge role={p.role} />
                </td>
                <td className="px-5 py-3">
                  {p.is_active ? <Badge>Active</Badge> : <Badge tone="danger">Deactivated</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}
