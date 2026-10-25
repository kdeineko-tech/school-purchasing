import { beforeEach, describe, expect, it, vi } from "vitest";
import { setPermissions } from "@/app/admin/actions";
import { allowedPurchaseTypes, allowedRequestTypes, type PermissionHolder } from "@/lib/org/permissions";
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

const none = { canCardExpense: false, canCheckRequest: false, canVendorInvoice: false, canSelfPurchase: false };
const employee = (permissions: Partial<typeof none> = {}): PermissionHolder => ({
  role: "requester",
  ...none,
  ...permissions,
});

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.set(k, v));
  return data;
}

describe("дозволені типи заявок і закупівлі", () => {
  it("AC-ORG-17: працівнику без ролі admin з дозволом на «Витрату карткою» серед дозволених типів заявок є «Card expense»", () => {
    expect(allowedRequestTypes(employee({ canCardExpense: true }))).toContain("Card expense");
  });

  it("AC-ORG-26: у працівника без ролі admin і без дозволу на «Витрату карткою» серед дозволених типів заявок її немає", () => {
    expect(allowedRequestTypes(employee())).not.toContain("Card expense");
    expect(allowedRequestTypes(employee({ canCheckRequest: true }))).toEqual(["Check request"]);
  });

  it("AC-ORG-25: в адміністратора без дозволу на «Витрату карткою» серед дозволених типів заявок є «Card expense»", () => {
    expect(allowedRequestTypes({ ...none, role: "admin" })).toEqual([
      "Card expense",
      "Check request",
      "Vendor invoice",
    ]);
  });

  it("AC-ORG-27: у працівника без ролі admin і без дозволу «Self-purchase» серед типів закупівлі лише «Purchasing department»", () => {
    expect(allowedPurchaseTypes(employee())).toEqual(["Purchasing department"]);
  });

  it("з дозволом «Self-purchase» працівнику доступні обидва типи закупівлі", () => {
    expect(allowedPurchaseTypes(employee({ canSelfPurchase: true }))).toEqual([
      "Purchasing department",
      "Self-purchase",
    ]);
  });
});

describe("дія setPermissions", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockReset();
  });

  function fakeProfilesDb() {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq }));
    vi.mocked(createClient).mockResolvedValue({ from: vi.fn(() => ({ update })) } as never);
    return { update, eq };
  }

  it("AC-ORG-17: адміністратор видає працівнику дозвіл на «Витрату карткою» — позначені прапорці стають дозволами", async () => {
    vi.mocked(getViewer).mockResolvedValue({
      id: "a1",
      email: "admin@example.test",
      fullName: null,
      role: "admin",
      isActive: true,
    });
    const { update, eq } = fakeProfilesDb();

    await expect(setPermissions(form({ profileId: P1, can_card_expense: "on" }))).rejects.toThrow(
      `REDIRECT /admin/staff/${P1}`,
    );
    expect(update).toHaveBeenCalledWith({
      can_card_expense: true,
      can_check_request: false,
      can_vendor_invoice: false,
      can_self_purchase: false,
    });
    expect(eq).toHaveBeenCalledWith("id", P1);
  });

  it("не-адміністратор дозволів не змінює", async () => {
    vi.mocked(getViewer).mockResolvedValue({
      id: P1,
      email: "member1@example.test",
      fullName: null,
      role: "requester",
      isActive: true,
    });
    const { update } = fakeProfilesDb();

    await expect(setPermissions(form({ profileId: P1, can_self_purchase: "on" }))).rejects.toThrow("REDIRECT /admin");
    expect(update).not.toHaveBeenCalled();
  });
});
