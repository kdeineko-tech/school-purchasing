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
  // Лише активні схвалювачі — фільтр у базі: їх мало, тож ліміт відповіді API (1000 рядків) не обрізає список.
  const [{ data: departments, error: departmentsError }, { data: rows, error: approversError }] =
    await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      supabase
        .from("department_members")
        .select("profile_id, department_id, profiles!inner(is_active)")
        .eq("approves", true)
        .eq("profiles.is_active", true),
    ]);
  const readError = departmentsError ?? approversError;
  if (readError) throw new Error(`Failed to read departments: ${readError.message}`);

  // AC-ORG-14: відділ без жодного активного схвалювача.
  const memberships = (rows ?? []).map((r) => ({
    profileId: r.profile_id,
    departmentId: r.department_id,
    approves: true,
  }));
  const active = new Set(memberships.map((m) => m.profileId));
  const withoutApprover = new Set(
    departmentsWithoutApprover(departments ?? [], memberships, active).map((d) => d.id),
  );

  return (
    <PageShell
      viewer={viewer}
      title="Departments"
      description="Requests are submitted on behalf of a department; names are unique regardless of case"
      back={{ href: "/admin", label: "Settings" }}
    >
      <Card title="New department">
        <form action={createDepartment} className="flex flex-col gap-3">
          <label htmlFor="name" className="sr-only">
            Department name
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input id="name" name="name" required maxLength={100} placeholder="For example, Primary School" />
            <Button type="submit">Create</Button>
          </div>
          {errorMessage && <Alert testId="department-error">{errorMessage}</Alert>}
        </form>
      </Card>

      <Card title={`All departments${departments?.length ? ` · ${departments.length}` : ""}`}>
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
          <EmptyState>No departments yet.</EmptyState>
        )}
      </Card>
    </PageShell>
  );
}
