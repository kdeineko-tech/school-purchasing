import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Badge, Card, EmptyState, RoleBadge } from "@/components/ui";
import { requesterDepartments } from "@/lib/org/membership";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

// Власний профіль: заявник і схвалювач бачать свої відділи, змінювати їх не можуть (вимога
// ValiaBihun/2026-quitcode-dream-team#2, «Користувачі й ролі»; AC-ORG-01).
export default async function ProfilePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const supabase = await createClient();
  // RLS: працівник бачить лише власні рядки department_members.
  const [{ data: departments, error: departmentsError }, { data: rows, error: membersError }] =
    await Promise.all([
      supabase.from("departments").select("id, name"),
      supabase.from("department_members").select("profile_id, department_id").eq("profile_id", viewer.id),
    ]);
  // Помилку бази не видаємо за «Немає».
  const readError = departmentsError ?? membersError;
  if (readError) throw new Error(`Не вдалося прочитати відділи: ${readError.message}`);
  const memberships = (rows ?? []).map((r) => ({ profileId: r.profile_id, departmentId: r.department_id }));
  const mine = requesterDepartments(memberships, departments ?? [], viewer.id);

  return (
    <PageShell viewer={viewer} title="Мій профіль" description={viewer.email ?? undefined}>
      <Card>
        <RoleBadge role={viewer.role} />
      </Card>
      <Card title="Відділи, де я подаю заявки">
        {mine.length > 0 ? (
          <ul className="flex flex-wrap gap-2" data-testid="requester-departments">
            {mine.map((d) => (
              <li key={d.id}>
                <Badge tone="accent">{d.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Немає.</EmptyState>
        )}
      </Card>
    </PageShell>
  );
}
