import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Badge, Card, EmptyState, RoleBadge } from "@/components/ui";
import { approvedDepartments, autoApproveDepartments, requesterDepartments } from "@/lib/org/membership";
import { allowedPurchaseTypes, allowedRequestTypes, permissionsFromRow } from "@/lib/org/permissions";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

// Власний профіль: заявник і схвалювач бачать свої відділи — де подають заявки, де схвалюють і де ввімкнено
// автосхвалення, — змінювати їх не можуть (вимога ValiaBihun/2026-quitcode-dream-team#2, «Користувачі й ролі»;
// AC-ORG-01), і переходять до своїх заявок.
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
    supabase
      .from("department_members")
      .select("profile_id, department_id, approves, auto_approve")
      .eq("profile_id", viewer.id),
    supabase
      .from("profiles")
      .select("can_card_expense, can_check_request, can_vendor_invoice, can_self_purchase")
      .eq("id", viewer.id)
      .single(),
  ]);
  // Помилку бази не видаємо за «Немає».
  const readError = departmentsError ?? membersError ?? ownError;
  if (readError || !own) throw new Error(`Failed to read profile: ${readError?.message ?? "no data"}`);
  const memberships = (rows ?? []).map((r) => ({
    profileId: r.profile_id,
    departmentId: r.department_id,
    approves: r.approves,
    autoApprove: r.auto_approve,
  }));
  const mine = requesterDepartments(memberships, departments ?? [], viewer.id);
  const approving = new Set(approvedDepartments(memberships, departments ?? [], viewer.id).map((d) => d.id));
  const autoApproving = new Set(autoApproveDepartments(memberships, departments ?? [], viewer.id).map((d) => d.id));
  // Власні дозволи — лише перегляд; змінює їх адміністратор (AC-ORG-17, AC-ORG-25 … AC-ORG-27).
  const holder = { ...permissionsFromRow(own), role: viewer.role };
  const requestTypes = allowedRequestTypes(holder);
  const purchaseTypes = allowedPurchaseTypes(holder);

  return (
    <PageShell viewer={viewer} title="My profile" description={viewer.email ?? undefined}>
      <Card>
        <RoleBadge role={viewer.role} />
      </Card>
      <Card title="My departments">
        {mine.length > 0 ? (
          <ul className="flex flex-col divide-y divide-border text-sm" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid="my-department">
                <span className="font-medium">{d.name}</span>
                <span className="flex flex-wrap gap-2">
                  <Badge>Requester</Badge>
                  {approving.has(d.id) && <Badge tone="accent">Approver</Badge>}
                  {autoApproving.has(d.id) && <Badge>Auto-approval</Badge>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>None.</EmptyState>
        )}
      </Card>
      <Card title="My work">
        <nav className="flex flex-wrap gap-4 text-sm" data-testid="profile-links">
          <Link href="/purchases/new" className="text-accent hover:underline">
            New purchase
          </Link>
          <Link href="/purchases" className="text-accent hover:underline">
            My requests
          </Link>
          {viewer.role !== "requester" && (
            <Link href="/approvals" className="text-accent hover:underline">
              Approvals
            </Link>
          )}
        </nav>
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
