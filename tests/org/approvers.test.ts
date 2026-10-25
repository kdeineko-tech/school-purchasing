import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeRequester as removeRequesterAction, setApprover as setApproverAction } from "@/app/admin/actions";
import { departmentsWithoutApprover } from "@/lib/org/departments";
import { removeRequester, setApprover, type Membership } from "@/lib/org/membership";
import { MESSAGES } from "@/lib/org/messages";
import { roleFor } from "@/lib/org/roles";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const P1 = "00000000-0000-4000-8000-000000000001";
const PRIMARY = "00000000-0000-4000-8000-0000000000d1"; // «Початкова школа»
const OFFICE = "00000000-0000-4000-8000-0000000000d2"; // «Офіс»
const HIGH = "00000000-0000-4000-8000-0000000000d3"; // «Вища школа»

const admin = { id: "a1", email: "admin@example.test", fullName: null, role: "admin", isActive: true } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.set(k, v));
  return data;
}

// Підставна база для department_members: читання одного рядка, update і delete.
function fakeMembersDb(row: { profile_id: string; department_id: string; approves: boolean } | null) {
  const update = vi.fn(() => ({
    eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: row ? [row] : [], error: null }) }) }),
  }));
  const del = vi.fn(() => ({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) }));
  const select = vi.fn(() => ({
    eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
  }));
  vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select, update, delete: del })) } as never);
  return { update, del };
}

describe("схвалювачі відділу", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue(admin);
  });

  it("AC-ORG-02: працівника, який не є заявником «Вища школа», не призначено схвалювачем — «Спершу додайте працівника до відділу як заявника»", () => {
    expect(setApprover([], P1, HIGH, true)).toEqual({
      ok: false,
      error: "Add the employee to the department as a requester first",
    });
  });

  it("AC-ORG-02: дія setApprover не змінює базу й повертає адміністратора з повідомленням", async () => {
    const { update } = fakeMembersDb(null);

    await expect(setApproverAction(form({ profileId: P1, departmentId: HIGH, approves: "true" }))).rejects.toThrow(
      `REDIRECT /admin/staff/${P1}?error=${encodeURIComponent(MESSAGES.addAsRequesterFirst)}`,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("AC-ORG-03: заявник і схвалювач «Початкова школа» після зняття як заявника перестає бути схвалювачем", () => {
    const before: Membership[] = [{ profileId: P1, departmentId: PRIMARY, approves: true }];

    const after = removeRequester(before, P1, PRIMARY);

    expect(after.some((m) => m.departmentId === PRIMARY && m.approves)).toBe(false);
  });

  it("AC-ORG-03: дія removeRequester видаляє рядок заявника разом зі схваленням", async () => {
    const { del } = fakeMembersDb({ profile_id: P1, department_id: PRIMARY, approves: true });

    await expect(removeRequesterAction(form({ profileId: P1, departmentId: PRIMARY }))).rejects.toThrow(
      `REDIRECT /admin/staff/${P1}`,
    );
    expect(del).toHaveBeenCalled();
  });

  it("AC-ORG-04: працівник без ролі admin, що схвалював лише один відділ, після зняття зі схвалювачів стає requester", () => {
    const before: Membership[] = [{ profileId: P1, departmentId: PRIMARY, approves: true }];
    const change = setApprover(before, P1, PRIMARY, false);

    expect(change.ok && roleFor("approver", change.memberships, P1)).toBe("requester");
  });

  it("AC-ORG-05: працівник без ролі admin після призначення схвалювачем відділу, де він заявник, стає approver", () => {
    const before: Membership[] = [{ profileId: P1, departmentId: PRIMARY, approves: false }];
    const change = setApprover(before, P1, PRIMARY, true);

    expect(change.ok && roleFor("requester", change.memberships, P1)).toBe("approver");
  });

  it("AC-ORG-05: дія setApprover заявнику відділу записує схвалення", async () => {
    const { update } = fakeMembersDb({ profile_id: P1, department_id: PRIMARY, approves: false });

    await expect(setApproverAction(form({ profileId: P1, departmentId: PRIMARY, approves: "true" }))).rejects.toThrow(
      `REDIRECT /admin/staff/${P1}`,
    );
    expect(update).toHaveBeenCalledWith({ approves: true });
  });

  it("дія setApprover з некоректним значенням approves не змінює схвалення", async () => {
    const { update } = fakeMembersDb({ profile_id: P1, department_id: PRIMARY, approves: true });

    await expect(setApproverAction(form({ profileId: P1, departmentId: PRIMARY, approves: "yes" }))).rejects.toThrow(
      `REDIRECT /admin/staff/${P1}`,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it("AC-ORG-19: схвалювач «Початкова школа» й «Офіс» після зняття лише з «Офіс» лишається approver і далі схвалює «Початкова школа»", () => {
    const before: Membership[] = [
      { profileId: P1, departmentId: PRIMARY, approves: true },
      { profileId: P1, departmentId: OFFICE, approves: true },
    ];
    const change = setApprover(before, P1, OFFICE, false);

    expect(change.ok && roleFor("approver", change.memberships, P1)).toBe("approver");
    expect(change.ok && change.memberships.find((m) => m.departmentId === PRIMARY)?.approves).toBe(true);
  });

  it("AC-ORG-20: адміністратор після призначення схвалювачем відділу лишається admin і може схвалювати заявки відділу", () => {
    const before: Membership[] = [{ profileId: P1, departmentId: PRIMARY, approves: false }];
    const change = setApprover(before, P1, PRIMARY, true);

    expect(change.ok && roleFor("admin", change.memberships, P1)).toBe("admin");
    expect(change.ok && change.memberships[0].approves).toBe(true);
  });

  it("AC-ORG-24: працівник без ролі admin, що схвалює лише «Початкова школа», після зняття як заявника стає requester", () => {
    const before: Membership[] = [{ profileId: P1, departmentId: PRIMARY, approves: true }];

    expect(roleFor("approver", removeRequester(before, P1, PRIMARY), P1)).toBe("requester");
  });
});

describe("відділи без схвалювача", () => {
  const departments = [
    { id: PRIMARY, name: "Початкова школа" },
    { id: OFFICE, name: "Офіс" },
  ];

  it("AC-ORG-14: відділ без жодного активного схвалювача позначено «Немає схвалювача»", () => {
    const memberships: Membership[] = [
      { profileId: P1, departmentId: PRIMARY, approves: true },
      { profileId: "inactive", departmentId: OFFICE, approves: true },
    ];

    const flagged = departmentsWithoutApprover(departments, memberships, new Set([P1]));

    expect(flagged.map((d) => d.name)).toEqual(["Офіс"]);
    expect(MESSAGES.noApprover).toBe("No approver");
  });
});
