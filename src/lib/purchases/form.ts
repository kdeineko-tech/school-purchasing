// Форма закупівлі: які відділи й типи може обрати працівник і чи можна подати закупівлю (impl-add-purchase-flow,
// design.md, розділ 4). Ті самі правила тримає функція бази private.submit_purchase — друга лінія захисту
// (ADR docs/decisions/0003-purchase-submission-rpc.md).
import type { AppRole } from "@/lib/org/access";
import { requesterDepartments, type Department, type Membership } from "@/lib/org/membership";
import { MESSAGES } from "@/lib/org/messages";
import { allowedPurchaseTypes, type PermissionHolder, type PurchaseType } from "@/lib/org/permissions";

// Ідентифікатори в базі (purchases.purchase_type, purchases.status); підписи англійською — таблиця вимоги
// ValiaBihun/2026-quitcode-dream-team#49 (AC-LANG-06).
export type PurchaseTypeId = "purchasing_department" | "self_purchase";
export type PurchaseStatus = "awaiting_approval" | "approved" | "rejected";

export const PURCHASE_TYPE_LABELS: Record<PurchaseTypeId, PurchaseType> = {
  purchasing_department: "Purchasing department",
  self_purchase: "Self-purchase",
};

export const STATUS_LABELS: Record<PurchaseStatus, string> = {
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

// Дати й час — за часом America/New_York («Припущення» вимоги ValiaBihun/2026-quitcode-dream-team#47).
const SUBMITTED_AT = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/New_York",
  dateStyle: "short",
  timeStyle: "short",
});

export function formatSubmittedAt(isoTimestamp: string): string {
  return SUBMITTED_AT.format(new Date(isoTimestamp));
}

export type PurchaseLineInput = {
  name: string;
  purpose: string;
  quantity: string;
  unitPrice: string;
};

export type FormOptions = {
  departments: Department[];
  purchaseTypes: PurchaseTypeId[];
};

// Відділи у формі: адміністратор — будь-який (AC-ORG-22, AC-ORG-29); інші — лише де заявник (AC-FRM-01).
// Порожній список — працівник без відділів (AC-FRM-05).
export function formDepartments(
  viewer: { id: string; role: AppRole },
  memberships: readonly Membership[],
  departments: readonly Department[],
): Department[] {
  if (viewer.role === "admin") return [...departments].sort((a, b) => a.name.localeCompare(b.name, "en"));
  return requesterDepartments(memberships, departments, viewer.id);
}

// Типи закупівлі у формі — за дозволами профілю (AC-FRM-03, AC-ORG-23).
export function formPurchaseTypes(holder: PermissionHolder): PurchaseTypeId[] {
  const allowed = new Set<PurchaseType>(allowedPurchaseTypes(holder));
  return (Object.keys(PURCHASE_TYPE_LABELS) as PurchaseTypeId[]).filter((id) => allowed.has(PURCHASE_TYPE_LABELS[id]));
}

export type SubmissionCheck = { ok: true } | { ok: false; error: string };

// Подати можна лише у відділ і тип зі списків форми (AC-FRM-02, AC-FRM-04) і з хоча б одним рядком (AC-FRM-06).
// Наявність схвалювача не перевіряємо: заявка чекає (AC-FRM-12).
export function validateSubmission(
  input: { departmentId: string; purchaseType: string; lines: readonly PurchaseLineInput[] },
  options: FormOptions,
): SubmissionCheck {
  if (!options.departments.some((d) => d.id === input.departmentId)) return { ok: false, error: MESSAGES.forbidden };
  if (!options.purchaseTypes.some((t) => t === input.purchaseType)) return { ok: false, error: MESSAGES.forbidden };
  if (input.lines.length === 0) return { ok: false, error: MESSAGES.noLines };
  return { ok: true };
}

// Рядки з прихованого поля форми (JSON). Поля рядка не перевіряємо: обов'язковість — питання PM Q8
// (ValiaBihun/2026-quitcode-dream-team#60); те, що не є масивом об'єктів, — «рядків немає».
export function parseLines(raw: unknown): PurchaseLineInput[] {
  if (typeof raw !== "string") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  return parsed
    .filter((line): line is Record<string, unknown> => typeof line === "object" && line !== null && !Array.isArray(line))
    .map((line) => ({
      name: text(line.name),
      purpose: text(line.purpose),
      quantity: text(line.quantity),
      unitPrice: text(line.unitPrice),
    }));
}

// Формат p_lines для rpc('submit_purchase').
export function linesForDatabase(lines: readonly PurchaseLineInput[]) {
  return lines.map((l) => ({ name: l.name, purpose: l.purpose, quantity: l.quantity, unit_price: l.unitPrice }));
}

// Хто бачить закупівлю: автор, схвалювач її відділу, адміністратор (матриця прав requirements/product.md,
// «Бачити заявки»; AC-FRM-08). Те саме правило в базі — політика purchases_select_visible.
export function canSeePurchase(
  viewer: { id: string; role: AppRole },
  purchase: { authorId: string; departmentId: string },
  approvedDepartmentIds: readonly string[],
): boolean {
  return (
    viewer.role === "admin" ||
    purchase.authorId === viewer.id ||
    approvedDepartmentIds.includes(purchase.departmentId)
  );
}
