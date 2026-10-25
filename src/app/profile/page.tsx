import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Badge, Card, EmptyState, RoleBadge } from "@/components/ui";
import { requesterDepartments } from "@/lib/org/membership";
import { allowedPurchaseTypes, allowedRequestTypes, permissionsFromRow } from "@/lib/org/permissions";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

// Власний профіль: заявник і схвалювач бачать свої відділи, змінювати їх не можуть (вимога
// ValiaBihun/2026-quitcode-dream-team#2, «Користувачі й ролі»; AC-ORG-01).
export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const supabase = await createClient();
  // RLS: працівник бачить лише власні рядки department_members.
  const [
    { data: departments, error: departmentsError },
    { data: rows, error: membersError },
    { data: own, error: ownError },
  ] = await Promise.all([
    supabase.from("departments").select("id, name"),
    supabase.from("department_members").select("profile_id, department_id").eq("profile_id", viewer.id),
    supabase
      .from("profiles")
      .select("can_card_expense, can_check_request, can_vendor_invoice, can_self_purchase")
      .eq("id", viewer.id)
      .single(),
  ]);
  // Помилку бази не видаємо за «Немає».
  const readError = departmentsError ?? membersError ?? ownError;
  if (readError || !own) throw new Error(`Не вдалося прочитати профіль: ${readError?.message ?? "немає даних"}`);
  const memberships = (rows ?? []).map((r) => ({ profileId: r.profile_id, departmentId: r.department_id }));
  const mine = requesterDepartments(memberships, departments ?? [], viewer.id);
  // Власні дозволи — лише перегляд; змінює їх адміністратор (AC-ORG-17, AC-ORG-25 … AC-ORG-27).
  const holder = { ...permissionsFromRow(own), role: viewer.role };
  const requestTypes = allowedRequestTypes(holder);
  const purchaseTypes = allowedPurchaseTypes(holder);

  return (
    <PageShell viewer={viewer} title="My profile" description={viewer.email ?? undefined}>
      <Card>
        <RoleBadge role={viewer.role} />
      </Card>
      <Card title="Departments where I submit requests">
        {mine.length > 0 ? (
          <ul className="flex flex-wrap gap-2" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id}>
                <Badge tone="accent">{d.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>None.</EmptyState>
        )}
      </Card>
      <Card title="My permissions">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted">Allowed request types</dt>
          <dd className="flex flex-wrap gap-2">
            {requestTypes.length > 0 ? requestTypes.map((t) => <Badge key={t}>{t}</Badge>) : "—"}
          </dd>
          <dt className="text-muted">Allowed purchase types</dt>
          <dd className="flex flex-wrap gap-2">
            {purchaseTypes.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </dd>
        </dl>
      </Card>
    </PageShell>
  );
}
