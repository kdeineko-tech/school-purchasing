import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Badge, Button, Card, EmptyState, RoleBadge, Select } from "@/components/ui";
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
  if (!canOpenAdminPages(viewer)) return <NoAccess viewer={viewer} />;

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
    <PageShell
      viewer={viewer}
      title={profile.full_name ?? profile.email ?? "Працівник"}
      description={profile.email ?? undefined}
      back={{ href: "/admin/staff", label: "Працівники" }}
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={profile.role} />
          {profile.is_active ? <Badge>Активний</Badge> : <Badge tone="danger">Деактивований</Badge>}
        </div>
      </Card>

      <Card title="Відділи, де подає заявки">
        {mine.length > 0 ? (
          <ul className="mb-4 flex flex-wrap gap-2" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id}>
                <Badge tone="accent">{d.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-4">
            <EmptyState>Немає.</EmptyState>
          </div>
        )}

        {others.length > 0 && (
          <form action={addRequester} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="profileId" value={profile.id} />
            <Select name="departmentId" required aria-label="Відділ">
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button type="submit" className="shrink-0">
              Додати як заявника
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
