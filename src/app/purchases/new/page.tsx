import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { Alert, Card } from "@/components/ui";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { loadFormOptions } from "@/lib/purchases/options";
import { PurchaseForm } from "./purchase-form";

export const metadata: Metadata = { title: "New purchase" };

// Форма закупівлі: лише після входу (AC-FRM-09); відділи й типи — за правами працівника (AC-FRM-01, AC-FRM-03,
// AC-ORG-22, AC-ORG-23, AC-ORG-29); без відділів — повідомлення замість полів (AC-FRM-05).
export default async function NewPurchasePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const options = await loadFormOptions(viewer);

  return (
    <PageShell viewer={viewer} title="New purchase" back={{ href: "/purchases", label: "My requests" }}>
      <Card>
        {options.departments.length === 0 ? (
          <Alert testId="no-departments">{MESSAGES.noDepartments}</Alert>
        ) : (
          <PurchaseForm departments={options.departments} purchaseTypes={options.purchaseTypes} />
        )}
      </Card>
    </PageShell>
  );
}
