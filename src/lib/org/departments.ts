// Відділи (AC-ORG-34). Те саме правило в базі: check довжини й унікальний індекс lower(btrim(name)).
import { MESSAGES } from "./messages";

export const DEPARTMENT_NAME_MAX = 100;

export function normalizeDepartmentName(name: string): string {
  return name.trim();
}

export function isDuplicateName(name: string, existing: readonly string[]): boolean {
  const key = normalizeDepartmentName(name).toLocaleLowerCase("uk");
  return existing.some((other) => normalizeDepartmentName(other).toLocaleLowerCase("uk") === key);
}

export type NewDepartmentCheck = { ok: true; name: string } | { ok: false; error: string };

export function validateNewDepartment(name: string, existing: readonly string[]): NewDepartmentCheck {
  const normalized = normalizeDepartmentName(name);
  if (normalized.length === 0 || normalized.length > DEPARTMENT_NAME_MAX) {
    return { ok: false, error: MESSAGES.departmentNameInvalid };
  }
  if (isDuplicateName(normalized, existing)) {
    return { ok: false, error: MESSAGES.departmentExists };
  }
  return { ok: true, name: normalized };
}
