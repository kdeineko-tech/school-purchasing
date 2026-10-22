// Хоча б один активний адміністратор (AC-ORG-18) — те саме правило, що й тригер private.guard_last_admin.
import type { AppRole } from "./access";

export type StaffState = { id: string; role: AppRole; isActive: boolean };

export function leavesNoActiveAdmin(staff: readonly StaffState[], targetId: string, nextActive: boolean): boolean {
  const after = staff.map((p) => (p.id === targetId ? { ...p, isActive: nextActive } : p));
  return !after.some((p) => p.role === "admin" && p.isActive);
}
