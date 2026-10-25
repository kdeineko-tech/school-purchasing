// Дозволені типи заявок і закупівлі (AC-ORG-17, AC-ORG-25, AC-ORG-26, AC-ORG-27). Назви — з глосарію
// requirements/product.md; той самий набір перевірятиме форма закупівлі другого зрізу (AC-FRM-03, AC-FRM-04).
import type { AppRole } from "./access";

export const PERMISSION_REQUEST_TYPES = ["Card expense", "Check request", "Vendor invoice"] as const;
export type PermissionRequestType = (typeof PERMISSION_REQUEST_TYPES)[number];

export const PURCHASE_TYPES = ["Purchasing department", "Self-purchase"] as const;
export type PurchaseType = (typeof PURCHASE_TYPES)[number];

export type Permissions = {
  canCardExpense: boolean;
  canCheckRequest: boolean;
  canVendorInvoice: boolean;
  canSelfPurchase: boolean;
};

export type PermissionHolder = Permissions & { role: AppRole };

// Типи заявок, на які потрібен дозвіл: адміністратору — усі (AC-ORG-25), іншим — лише видані (AC-ORG-17, AC-ORG-26).
export function allowedRequestTypes(holder: PermissionHolder): PermissionRequestType[] {
  if (holder.role === "admin") return [...PERMISSION_REQUEST_TYPES];
  const granted: Record<PermissionRequestType, boolean> = {
    "Card expense": holder.canCardExpense,
    "Check request": holder.canCheckRequest,
    "Vendor invoice": holder.canVendorInvoice,
  };
  return PERMISSION_REQUEST_TYPES.filter((type) => granted[type]);
}

// Типи закупівлі: «Self-purchase» — адміністратору (AC-ORG-23) або з дозволом; інакше лише
// «Purchasing department» (AC-ORG-27).
export function allowedPurchaseTypes(holder: PermissionHolder): PurchaseType[] {
  return holder.role === "admin" || holder.canSelfPurchase ? [...PURCHASE_TYPES] : ["Purchasing department"];
}

export function permissionsFromRow(row: {
  can_card_expense: boolean;
  can_check_request: boolean;
  can_vendor_invoice: boolean;
  can_self_purchase: boolean;
}): Permissions {
  return {
    canCardExpense: row.can_card_expense,
    canCheckRequest: row.can_check_request,
    canVendorInvoice: row.can_vendor_invoice,
    canSelfPurchase: row.can_self_purchase,
  };
}
