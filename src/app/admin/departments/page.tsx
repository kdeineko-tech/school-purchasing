import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Alert, Badge, Button, Card, EmptyState, Input } from "@/components/ui";
import { canOpenAdminPages } from "@/lib/org/access";
import { departmentsWithoutApprover } from "@/lib/org/departments";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { createDepartment } from "../actions";
import { NoAccess } from "../no-access";

// Налаштування відділів — лише для адміністратора (AC-ORG-09); створення відділу (AC-ORG-34).
export default async function DepartmentsPage({ searchParams }: PageProps<"/admin/departments">) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpenAdminPages(viewer)) return <NoAccess viewer={viewer} />;

  // Показуємо лише власні повідомлення застосунку, а не довільний текст з адреси.
  const { error } = await searchParams;
  const known: string[] = Object.values(MESSAGES);
  const errorMessage = typeof error === "string" && known.includes(error) ? error : null;

  const supabase = await createClient();
  const [
    { data: departments, error: departmentsError },
    { data: rows, error: membersError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("department_members").select("profile_id, department_id, approves"),
    supabase.from("profiles").select("id, is_active"),
  ]);
  const readError = departmentsError ?? membersError ?? profilesError;
  if (readError) throw new Error(`Не вдалося прочитати відділи: ${readError.message}`);

  // AC-ORG-14: відділ без жодного активного схвалювача.
  const memberships = (rows ?? []).map((r) => ({
    profileId: r.profile_id,
    departmentId: r.department_id,
    approves: r.approves,
  }));
  const active = new Set((profiles ?? []).filter((p) => p.is_active).map((p) => p.id));
  const withoutApprover = new Set(
    departmentsWithoutApprover(departments ?? [], memberships, active).map((d) => d.id),
  );

  return (
    <PageShell
      viewer={viewer}
      title="Відділи"
      description="Від імені відділу подають заявки; назва унікальна без урахування регістру"
      back={{ href: "/admin", label: "Налаштування" }}
    >
      <Card title="Новий відділ">
        <form action={createDepartment} className="flex flex-col gap-3">
          <label htmlFor="name" className="sr-only">
            Назва відділу
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="name" name="name" required maxLength={100} placeholder="Наприклад, Початкова школа" />
            <Button type="submit">Створити</Button>
          </div>
          {errorMessage && <Alert testId="department-error">{errorMessage}</Alert>}
        </form>
      </Card>

      <Card title={`Усі відділи${departments?.length ? ` · ${departments.length}` : ""}`}>
        {departments && departments.length > 0 ? (
          <ul className="divide-y divide-border text-sm" data-testid="departments">
            {departments.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>{d.name}</span>
                {withoutApprover.has(d.id) && <Badge tone="danger">{MESSAGES.noApprover}</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Відділів ще немає.</EmptyState>
        )}
      </Card>
    </PageShell>
  );
}
