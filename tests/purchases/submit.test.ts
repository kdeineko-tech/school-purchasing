import { beforeEach, describe, expect, it, vi } from "vitest";
import { submitPurchase } from "@/app/purchases/actions";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { createClient } from "@/lib/supabase/server";
import { ADMIN, fakeDb, form, HIGH, ONE_LINE, OFFICE, P1, PRIMARY, viewer } from "./fake-db";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

function useDb(state: Parameters<typeof fakeDb>[0]) {
  const db = fakeDb({ departments: [PRIMARY, OFFICE, HIGH], ...state });
  vi.mocked(createClient).mockResolvedValue(db.client as never);
  return db;
}

const member1 = [{ profile_id: P1, department_id: PRIMARY.id }];

describe("подання закупівлі (submitPurchase)", () => {
  beforeEach(() => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1));
  });

  it("AC-FRM-07: працівник 1 подає закупівлю з рядком «Paper A4» у «Primary School» — rpc submit_purchase", async () => {
    const { rpc } = useDb({ members: member1 });

    await expect(
      submitPurchase({}, form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: ONE_LINE })),
    ).rejects.toThrow("REDIRECT /purchases?submitted=1");
    expect(rpc).toHaveBeenCalledWith("submit_purchase", {
      p_department_id: PRIMARY.id,
      p_purchase_type: "purchasing_department",
      p_lines: [{ name: "Paper A4", purpose: "Printing", quantity: "3", unit_price: "20.00" }],
    });
  });

  it("AC-FRM-11: після подання працівник потрапляє на «Мої заявки» з повідомленням про подання", async () => {
    useDb({ members: member1 });

    await expect(
      submitPurchase({}, form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: ONE_LINE })),
    ).rejects.toThrow("REDIRECT /purchases?submitted=1");
    expect(MESSAGES.purchaseSubmitted).toBe("Purchase submitted");
  });

  it("AC-FRM-12: відділ без жодного схвалювача не блокує подання", async () => {
    // У «Primary School» немає рядка з approves = true: подання все одно доходить до бази.
    const { rpc } = useDb({ members: member1 });

    await expect(
      submitPurchase({}, form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: ONE_LINE })),
    ).rejects.toThrow("REDIRECT /purchases?submitted=1");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("AC-FRM-02: подання у «High School», де працівник 1 не заявник, не доходить до бази", async () => {
    const { rpc } = useDb({ members: member1 });

    const state = await submitPurchase(
      {},
      form({ departmentId: HIGH.id, purchaseType: "purchasing_department", lines: ONE_LINE }),
    );

    expect(state).toEqual({ error: MESSAGES.forbidden });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-FRM-02: відмова бази FORBIDDEN (обхід перевірки сторінки) дає те саме повідомлення, без переходу", async () => {
    useDb({ members: member1, rpcError: { message: "FORBIDDEN" } });

    const state = await submitPurchase(
      {},
      form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: ONE_LINE }),
    );

    expect(state).toEqual({ error: MESSAGES.forbidden });
  });

  it("AC-FRM-04: «Self-purchase» без дозволу не подано", async () => {
    const { rpc } = useDb({ members: member1, selfPurchase: false });

    const state = await submitPurchase({}, form({ departmentId: PRIMARY.id, purchaseType: "self_purchase", lines: ONE_LINE }));

    expect(state).toEqual({ error: MESSAGES.forbidden });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-FRM-06: закупівля без рядків не подана — «Add at least one line», без переходу", async () => {
    const { rpc } = useDb({ members: member1 });

    const state = await submitPurchase({}, form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: "[]" }));

    expect(state).toEqual({ error: "Add at least one line" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-LANG-04: відмова бази NO_LINES показана англійською «Add at least one line»", async () => {
    useDb({ members: member1, rpcError: { message: "NO_LINES" } });

    const state = await submitPurchase(
      {},
      form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: ONE_LINE }),
    );

    expect(state).toEqual({ error: "Add at least one line" });
  });

  it("AC-ORG-22: адміністратор без відділів подає закупівлю в будь-який відділ", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(ADMIN, "admin"));
    const { rpc } = useDb({ members: [] });

    await expect(
      submitPurchase({}, form({ departmentId: OFFICE.id, purchaseType: "purchasing_department", lines: ONE_LINE })),
    ).rejects.toThrow("REDIRECT /purchases?submitted=1");
    expect(rpc).toHaveBeenCalled();
  });

  it("AC-ORG-23: адміністратор без дозволу подає «Self-purchase»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(ADMIN, "admin"));
    const { rpc } = useDb({ members: [] });

    await expect(
      submitPurchase({}, form({ departmentId: OFFICE.id, purchaseType: "self_purchase", lines: ONE_LINE })),
    ).rejects.toThrow("REDIRECT /purchases?submitted=1");
    expect(rpc).toHaveBeenCalledWith("submit_purchase", expect.objectContaining({ p_purchase_type: "self_purchase" }));
  });

  it("кількість чи ціна, які база не приводить до числа (INVALID_LINE), — повідомлення у формі, без переходу", async () => {
    useDb({ members: member1, rpcError: { message: "INVALID_LINE" } });

    const state = await submitPurchase(
      {},
      form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: ONE_LINE }),
    );

    expect(state).toEqual({ error: "Check the quantity and price in each line" });
  });

  it("гість не подає закупівлю — сторінка входу", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);
    const { rpc } = useDb({});

    await expect(submitPurchase({}, form({}))).rejects.toThrow("REDIRECT /login");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("невідома помилка бази не видається за успіх", async () => {
    useDb({ members: member1, rpcError: { message: "connection reset" } });

    await expect(
      submitPurchase({}, form({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: ONE_LINE })),
    ).rejects.toThrow("Failed to submit purchase");
  });
});
