import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAutoApprove as setAutoApproveAction } from "@/app/admin/actions";
import { autoApproveDepartments, removeRequester, setAutoApprove, type Membership } from "@/lib/org/membership";
import { MESSAGES } from "@/lib/org/messages";
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

const departments = [
  { id: PRIMARY, name: "Початкова школа" },
  { id: OFFICE, name: "Офіс" },
  { id: HIGH, name: "Вища школа" },
];

const admin = { id: "a1", email: "admin@example.test", fullName: null, role: "admin", isActive: true } as const;

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.set(k, v));
  return data;
}

// Підставна база для department_members: читання одного рядка й update.
function fakeMembersDb(row: { profile_id: string; department_id: string; auto_approve: boolean } | null) {
  const update = vi.fn(() => ({
    eq: () => ({ eq: () => ({ select: () => Promise.resolve({ data: row ? [row] : [], error: null }) }) }),
  }));
  const select = vi.fn(() => ({
    eq: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
  }));
  vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ select, update })) } as never);
  return { update };
}

describe("автосхвалення", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue(admin);
  });

  it("AC-ORG-06: заявнику «Початкова школа» й «Офіс» увімкнено автосхвалення лише в «Офіс» — для «Початкова школа» воно вимкнене", () => {
    const before: Membership[] = [
      { profileId: P1, departmentId: PRIMARY, autoApprove: false },
      { profileId: P1, departmentId: OFFICE, autoApprove: false },
    ];

    const change = setAutoApprove(before, P1, OFFICE, true);

    expect(change.ok && autoApproveDepartments(change.memberships, departments, P1).map((d) => d.name)).toEqual([
      "Офіс",
    ]);
  });

  it("AC-ORG-06: дія setAutoApprove записує автосхвалення лише в рядок обраного відділу", async () => {
    const { update } = fakeMembersDb({ profile_id: P1, department_id: OFFICE, auto_approve: false });

    await expect(
      setAutoApproveAction(form({ profileId: P1, departmentId: OFFICE, autoApprove: "true" })),
    ).rejects.toThrow(`REDIRECT /admin/staff/${P1}`);
    expect(update).toHaveBeenCalledWith({ auto_approve: true });
  });

  it("AC-ORG-15: заявник «Початкова школа» з автосхваленням після зняття як заявника втрачає автосхвалення відділу", () => {
    const before: Membership[] = [{ profileId: P1, departmentId: PRIMARY, autoApprove: true }];

    const after = removeRequester(before, P1, PRIMARY);

    expect(autoApproveDepartments(after, departments, P1)).toEqual([]);
  });

  it("AC-ORG-33: працівнику, який не є заявником «Вища школа», автосхвалення не ввімкнено — «Спершу додайте працівника до відділу як заявника»", () => {
    expect(setAutoApprove([], P1, HIGH, true)).toEqual({
      ok: false,
      error: "Спершу додайте працівника до відділу як заявника",
    });
  });

  it("AC-ORG-33: дія setAutoApprove не змінює базу й повертає адміністратора з повідомленням", async () => {
    const { update } = fakeMembersDb(null);

    await expect(
      setAutoApproveAction(form({ profileId: P1, departmentId: HIGH, autoApprove: "true" })),
    ).rejects.toThrow(`REDIRECT /admin/staff/${P1}?error=${encodeURIComponent(MESSAGES.addAsRequesterFirst)}`);
    expect(update).not.toHaveBeenCalled();
  });

  it("дія setAutoApprove з некоректним значенням не змінює автосхвалення", async () => {
    const { update } = fakeMembersDb({ profile_id: P1, department_id: OFFICE, auto_approve: true });

    await expect(
      setAutoApproveAction(form({ profileId: P1, departmentId: OFFICE, autoApprove: "yes" })),
    ).rejects.toThrow(`REDIRECT /admin/staff/${P1}`);
    expect(update).not.toHaveBeenCalled();
  });
});
