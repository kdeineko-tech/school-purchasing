import { notFound, redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Alert, Badge, Button, Card, EmptyState, RoleBadge, Select } from "@/components/ui";
import { canOpenAdminPages, type AppRole } from "@/lib/org/access";
import { requesterDepartments } from "@/lib/org/membership";
import { allowedPurchaseTypes, allowedRequestTypes, permissionsFromRow } from "@/lib/org/permissions";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { addRequester, removeRequester, setActive, setApprover, setAutoApprove, setPermissions } from "../../actions";
import { NoAccess } from "../../no-access";

// Профіль працівника для адміністратора (AC-ORG-09): відділи, де він подає заявки (AC-ORG-01),
// схвалення відділів і роль за ними (AC-ORG-02 … AC-ORG-05, AC-ORG-19, AC-ORG-20, AC-ORG-24),
// автосхвалення (AC-ORG-06, AC-ORG-15, AC-ORG-33).
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
    supabase
      .from("profiles")
      .select(
        "id, email, full_name, role, is_active, can_card_expense, can_check_request, can_vendor_invoice, can_self_purchase",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("departments").select("id, name").order("name"),
    supabase.from("department_members").select("profile_id, department_id, approves, auto_approve").eq("profile_id", id),
  ]);
  // Помилку бази не видаємо за «профілю немає» чи «відділів немає».
  const readError = profileError ?? departmentsError ?? membershipsError;
  if (readError) throw new Error(`Не вдалося прочитати профіль працівника: ${readError.message}`);
  if (!profile) notFound();

  const memberships = (rows ?? []).map((r) => ({
    profileId: r.profile_id,
    departmentId: r.department_id,
    approves: r.approves,
    autoApprove: r.auto_approve,
  }));
  const mine = requesterDepartments(memberships, departments ?? [], id);
  const others = (departments ?? []).filter((d) => !mine.some((m) => m.id === d.id));
  // AC-ORG-17, AC-ORG-25 … AC-ORG-27: дозволені типи в профілі працівника.
  const permissions = permissionsFromRow(profile);
  const holder = { ...permissions, role: profile.role as AppRole };
  const requestTypes = allowedRequestTypes(holder);
  const purchaseTypes = allowedPurchaseTypes(holder);

  const approves = (departmentId: string) => memberships.some((m) => m.departmentId === departmentId && m.approves);
  const autoApproves = (departmentId: string) =>
    memberships.some((m) => m.departmentId === departmentId && m.autoApprove);

  return (
    <PageShell
      viewer={viewer}
      title={profile.full_name ?? profile.email ?? "Employee"}
      description={profile.email ?? undefined}
      back={{ href: "/admin/staff", label: "Employees" }}
    >
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={profile.role} />
          {profile.is_active ? <Badge>Active</Badge> : <Badge tone="danger">Deactivated</Badge>}
          {/* AC-ORG-12: деактивований не входить у систему; AC-ORG-18: останнього активного адміністратора не деактивуємо. */}
          <form action={setActive} className="ml-auto">
            <input type="hidden" name="profileId" value={profile.id} />
            <input type="hidden" name="active" value={profile.is_active ? "false" : "true"} />
            <Button type="submit" variant="secondary">
              {profile.is_active ? "Deactivate" : "Activate"}
            </Button>
          </form>
        </div>
      </Card>

      {errorMessage && <Alert testId="staff-error">{errorMessage}</Alert>}

      <Card title="Departments where they submit requests">
        {mine.length > 0 ? (
          <ul className="mb-4 divide-y divide-border" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-medium">{d.name}</span>
                {approves(d.id) && <Badge tone="accent">Approver</Badge>}
                {autoApproves(d.id) && <Badge>Auto-approval</Badge>}
                <div className="ml-auto flex gap-2">
                  <form action={setApprover}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="departmentId" value={d.id} />
                    <input type="hidden" name="approves" value={approves(d.id) ? "false" : "true"} />
                    <Button type="submit" variant="secondary">
                      {approves(d.id) ? "Remove as approver" : "Make approver"}
                    </Button>
                  </form>
                  {/* AC-ORG-06: автосхвалення діє лише для цього відділу. */}
                  <form action={setAutoApprove}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="departmentId" value={d.id} />
                    <input type="hidden" name="autoApprove" value={autoApproves(d.id) ? "false" : "true"} />
                    <Button type="submit" variant="secondary">
                      {autoApproves(d.id) ? "Turn off auto-approval" : "Turn on auto-approval"}
                    </Button>
                  </form>
                  <form action={removeRequester}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="departmentId" value={d.id} />
                    <Button type="submit" variant="secondary">
                      Remove as requester
                    </Button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-4">
            <EmptyState>None.</EmptyState>
          </div>
        )}

        {others.length > 0 && (
          <form action={addRequester} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="profileId" value={profile.id} />
            <Select name="departmentId" required aria-label="Department">
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button type="submit" className="shrink-0">
              Add as requester
            </Button>
          </form>
        )}
      </Card>

      {others.length > 0 && (
        <Card title="Another department">
          {/* AC-ORG-02, AC-ORG-33: у відділі, де працівник не заявник, — відмова з повідомленням PM. */}
          <form action={setApprover} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="profileId" value={profile.id} />
            <input type="hidden" name="approves" value="true" />
            <input type="hidden" name="autoApprove" value="true" />
            <Select name="departmentId" required aria-label="Another department">
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="shrink-0">
              Make approver
            </Button>
            <Button type="submit" formAction={setAutoApprove} variant="secondary" className="shrink-0">
              Turn on auto-approval
            </Button>
          </form>
        </Card>
      )}
      <Card title="Дозволи">
        <dl className="mb-4 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Дозволені типи заявок</dt>
          <dd data-testid="allowed-request-types" className="flex flex-wrap gap-2">
            {requestTypes.length > 0 ? requestTypes.map((t) => <Badge key={t}>{t}</Badge>) : "—"}
          </dd>
          <dt className="text-muted">Дозволені типи закупівлі</dt>
          <dd data-testid="allowed-purchase-types" className="flex flex-wrap gap-2">
            {purchaseTypes.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </dd>
        </dl>
        {profile.role !== "admin" && (
          <form action={setPermissions} className="flex flex-col gap-2 text-sm">
            <input type="hidden" name="profileId" value={profile.id} />
            <label className="flex items-center gap-2">
              <input type="checkbox" name="can_card_expense" defaultChecked={permissions.canCardExpense} />
              Витрата карткою
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="can_check_request" defaultChecked={permissions.canCheckRequest} />
              Запит на чек
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="can_vendor_invoice" defaultChecked={permissions.canVendorInvoice} />
              Рахунок постачальника
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="can_self_purchase" defaultChecked={permissions.canSelfPurchase} />
              Самостійна закупівля
            </label>
            <Button type="submit" variant="secondary" className="mt-2 self-start">
              Зберегти дозволи
            </Button>
          </form>
        )}
      </Card>
    </PageShell>
  );
}
