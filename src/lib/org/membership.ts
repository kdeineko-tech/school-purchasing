// Заявники й схвалювачі відділів (AC-ORG-01, AC-ORG-02, AC-ORG-03). У базі — рядок department_members на пару
// «працівник — відділ», схвалення — його колонка approves (ADR docs/decisions/0001-department-membership.md).
import { MESSAGES } from "./messages";

export type Department = { id: string; name: string };
export type Membership = { profileId: string; departmentId: string; approves?: boolean };

export type MembershipChange = { ok: true; memberships: Membership[] } | { ok: false; error: string };

function isRow(m: Membership, profileId: string, departmentId: string) {
  return m.profileId === profileId && m.departmentId === departmentId;
}

export function addRequester(
  memberships: readonly Membership[],
  profileId: string,
  departmentId: string,
): Membership[] {
  const exists = memberships.some((m) => isRow(m, profileId, departmentId));
  return exists ? [...memberships] : [...memberships, { profileId, departmentId, approves: false }];
}

// Зняття заявника прибирає рядок разом зі схваленням цього відділу (AC-ORG-03).
export function removeRequester(
  memberships: readonly Membership[],
  profileId: string,
  departmentId: string,
): Membership[] {
  return memberships.filter((m) => !isRow(m, profileId, departmentId));
}

// Схвалювачем можна призначити лише заявника відділу (AC-ORG-02).
export function setApprover(
  memberships: readonly Membership[],
  profileId: string,
  departmentId: string,
  approves: boolean,
): MembershipChange {
  if (!memberships.some((m) => isRow(m, profileId, departmentId))) {
    return { ok: false, error: MESSAGES.addAsRequesterFirst };
  }
  return {
    ok: true,
    memberships: memberships.map((m) => (isRow(m, profileId, departmentId) ? { ...m, approves } : m)),
  };
}

function departmentsWhere(
  memberships: readonly Membership[],
  departments: readonly Department[],
  match: (m: Membership) => boolean,
): Department[] {
  const ids = new Set(memberships.filter(match).map((m) => m.departmentId));
  return departments
    .filter((d) => ids.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

// Відділи, де працівник подає заявки, — як їх показує профіль працівника.
export function requesterDepartments(
  memberships: readonly Membership[],
  departments: readonly Department[],
  profileId: string,
): Department[] {
  return departmentsWhere(memberships, departments, (m) => m.profileId === profileId);
}

// Відділи, які працівник схвалює.
export function approvedDepartments(
  memberships: readonly Membership[],
  departments: readonly Department[],
  profileId: string,
): Department[] {
  return departmentsWhere(memberships, departments, (m) => m.profileId === profileId && Boolean(m.approves));
}
