// Заявники відділів (AC-ORG-01). У базі — рядок department_members на пару «працівник — відділ»
// (ADR docs/decisions/0001-department-membership.md).

export type Department = { id: string; name: string };
export type Membership = { profileId: string; departmentId: string };

export function addRequester(
  memberships: readonly Membership[],
  profileId: string,
  departmentId: string,
): Membership[] {
  const exists = memberships.some((m) => m.profileId === profileId && m.departmentId === departmentId);
  return exists ? [...memberships] : [...memberships, { profileId, departmentId }];
}

// Відділи, де працівник подає заявки, — як їх показує профіль працівника.
export function requesterDepartments(
  memberships: readonly Membership[],
  departments: readonly Department[],
  profileId: string,
): Department[] {
  const ids = new Set(memberships.filter((m) => m.profileId === profileId).map((m) => m.departmentId));
  return departments
    .filter((d) => ids.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name, "uk"));
}
