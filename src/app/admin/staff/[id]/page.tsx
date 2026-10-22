import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Alert, Badge, Button, Card, EmptyState, RoleBadge, Select } from "@/components/ui";
import { canOpenAdminPages } from "@/lib/org/access";
import { requesterDepartments } from "@/lib/org/membership";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { addRequester, removeRequester, setActive, setApprover } from "../../actions";
import { NoAccess } from "../../no-access";

// Профіль працівника для адміністратора (AC-ORG-09): відділи, де він подає заявки (AC-ORG-01),
// схвалення відділів і роль за ними (AC-ORG-02 … AC-ORG-05, AC-ORG-19, AC-ORG-20, AC-ORG-24).
export default async function StaffProfilePage({ params, searchParams }: PageProps<"/admin/staff/[id]">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess viewer={viewer} />;

  const { id } = await params;
  // Показуємо лише власні повідомлення застосунку, а не довільний текст з адреси.
  const { error } = await searchParams;
  const known: string[] = Object.values(MESSAGES);
  const errorMessage = typeof error === "string" && known.includes(error) ? error : null;

  const supabase = await createClient();
  const [
    { data: profile, error: profileError },
    { data: departments, error: departmentsError },
    { data: rows, error: membershipsError },
  ] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, is_active").eq("id", id).maybeSingle(),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("department_members").select("profile_id, department_id, approves").eq("profile_id", id),
  ]);
  // Помилку бази не видаємо за «профілю немає» чи «відділів немає».
  const readError = profileError ?? departmentsError ?? membershipsError;
  if (readError) throw new Error(`Не вдалося прочитати профіль працівника: ${readError.message}`);
  if (!profile) notFound();

  const memberships = (rows ?? []).map((r) => ({
    profileId: r.profile_id,
    departmentId: r.department_id,
    approves: r.approves,
  }));
  const mine = requesterDepartments(memberships, departments ?? [], id);
  const others = (departments ?? []).filter((d) => !mine.some((m) => m.id === d.id));
  const approves = (departmentId: string) => memberships.some((m) => m.departmentId === departmentId && m.approves);

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
          {/* AC-ORG-12: деактивований не входить у систему; AC-ORG-18: останнього активного адміністратора не деактивуємо. */}
          <form action={setActive} className="ml-auto">
            <input type="hidden" name="profileId" value={profile.id} />
            <input type="hidden" name="active" value={profile.is_active ? "false" : "true"} />
            <Button type="submit" variant="secondary">
              {profile.is_active ? "Деактивувати" : "Активувати"}
            </Button>
          </form>
        </div>
      </Card>

      {errorMessage && <Alert testId="staff-error">{errorMessage}</Alert>}

      <Card title="Відділи, де подає заявки">
        {mine.length > 0 ? (
          <ul className="mb-4 divide-y divide-border" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-medium">{d.name}</span>
                {approves(d.id) && <Badge tone="accent">Схвалює</Badge>}
                <div className="ml-auto flex gap-2">
                  <form action={setApprover}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="departmentId" value={d.id} />
                    <input type="hidden" name="approves" value={approves(d.id) ? "false" : "true"} />
                    <Button type="submit" variant="secondary">
                      {approves(d.id) ? "Зняти зі схвалювачів" : "Призначити схвалювачем"}
                    </Button>
                  </form>
                  <form action={removeRequester}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="departmentId" value={d.id} />
                    <Button type="submit" variant="secondary">
                      Прибрати як заявника
                    </Button>
                  </form>
                </div>
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

      {others.length > 0 && (
        <Card title="Призначити схвалювачем іншого відділу">
          <form action={setApprover} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="profileId" value={profile.id} />
            <input type="hidden" name="approves" value="true" />
            <Select name="departmentId" required aria-label="Відділ для схвалення">
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="shrink-0">
              Призначити схвалювачем
            </Button>
          </form>
        </Card>
      )}
    </PageShell>
  );
}
