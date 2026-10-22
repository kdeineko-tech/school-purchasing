import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Alert, Button, Card, EmptyState, Input } from "@/components/ui";
import { canOpenAdminPages } from "@/lib/org/access";
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
  const { data: departments, error: readError } = await supabase
    .from("departments")
    .select("id, name")
    .order("name");
  if (readError) throw new Error(`Не вдалося прочитати відділи: ${readError.message}`);

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
              <li key={d.id} className="py-2.5">
                {d.name}
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
