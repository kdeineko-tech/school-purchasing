// Роль за відділами — те саме правило, що й тригер private.sync_role у базі (міграція approvers):
// approver — працівник без ролі admin, який схвалює хоча б один відділ; інакше requester;
// роль admin від відділів не залежить (requirements/product.md, «Правило ролей»).
import type { AppRole } from "./access";
import type { Membership } from "./membership";

export function roleFor(currentRole: AppRole, memberships: readonly Membership[], profileId: string): AppRole {
  if (currentRole === "admin") return "admin";
  const approvesAny = memberships.some((m) => m.profileId === profileId && m.approves);
  return approvesAny ? "approver" : "requester";
}
