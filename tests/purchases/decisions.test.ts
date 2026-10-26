import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApprovalsPage from "@/app/approvals/page";
import { decidePurchase } from "@/app/purchases/actions";
import PurchasePage from "@/app/purchases/[id]/page";
import { MESSAGES } from "@/lib/org/messages";
import { getViewer } from "@/lib/org/viewer";
import { canDecide, decisionList, validateDecision } from "@/lib/purchases/decisions";
import { createClient } from "@/lib/supabase/server";
import { form, OFFICE, P1, P2, PRIMARY, viewer } from "./fake-db";

vi.mock("@/lib/org/viewer", () => ({ getViewer: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const ID = "00000000-0000-4000-8000-0000000000c1";
const MARIA = P2; // схвалює «Primary School»

type Row = {
  id: string;
  author_id: string;
  department_id: string;
  purchase_type: string;
  status: string;
  rejection_reason?: string | null;
  created_at: string;
};
const row = (over: Partial<Row> = {}): Row => ({
  id: ID,
  author_id: P1,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status: "awaiting_approval",
  rejection_reason: null,
  created_at: "2026-10-25T15:00:00Z",
  ...over,
});

// Підставний Supabase для рішень: purchases — що повертає RLS; approves — відділи, які переглядач схвалює.
function setDb({ purchases = [], approves = [], rpcError = null }: { purchases?: Row[]; approves?: string[]; rpcError?: { message: string } | null }) {
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const rpc = vi.fn().mockResolvedValue({ data: null, error: rpcError });
  const listQuery = {
    in: () => listQuery,
    eq: () => listQuery,
    neq: () => listQuery,
    order: () => ok(purchases),
  };
  const client = {
    rpc,
    from: vi.fn((table: string) => {
      switch (table) {
        case "purchases":
          return {
            select: () => ({
              eq: () => ({ maybeSingle: () => ok(purchases[0] ?? null) }),
              in: () => listQuery,
            }),
          };
        case "purchase_lines":
          return { select: () => ({ eq: () => ({ order: () => ok([]) }) }) };
        case "department_members":
          return { select: () => ({ eq: () => ({ eq: () => ok(approves.map((d) => ({ department_id: d }))) }) }) };
        case "departments":
          return {
            select: () => Object.assign(ok([PRIMARY, OFFICE]), { eq: () => ({ maybeSingle: () => ok({ name: PRIMARY.name }) }) }),
          };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  vi.mocked(createClient).mockResolvedValue(client as never);
  return { rpc };
}

const pageProps = (searchParams: Record<string, string> = {}) =>
  ({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve(searchParams) }) as never;

describe("правила рішення", () => {
  const p = { authorId: P1, departmentId: PRIMARY.id, status: "awaiting_approval" };

  it("AC-APR-02: схвалювач відділу вирішує заявку «Очікує схвалення», автор якої не він", () => {
    expect(canDecide({ id: MARIA }, p, [PRIMARY.id])).toBe(true);
  });

  it("AC-APR-05: схвалювач не вирішує власну заявку", () => {
    expect(canDecide({ id: MARIA }, { ...p, authorId: MARIA }, [PRIMARY.id])).toBe(false);
  });

  it("AC-APR-03: схвалювач не вирішує заявку відділу, який не схвалює", () => {
    expect(canDecide({ id: MARIA }, { ...p, departmentId: OFFICE.id }, [PRIMARY.id])).toBe(false);
  });

  it("AC-APR-01: у списку для рішення лише дві заявки «Primary School», заявки «Office» немає", () => {
    const purchases = [
      { id: "a", authorId: P1, departmentId: PRIMARY.id, status: "awaiting_approval" },
      { id: "b", authorId: P1, departmentId: PRIMARY.id, status: "awaiting_approval" },
      { id: "c", authorId: P1, departmentId: OFFICE.id, status: "awaiting_approval" },
      { id: "d", authorId: MARIA, departmentId: PRIMARY.id, status: "awaiting_approval" },
      { id: "e", authorId: P1, departmentId: PRIMARY.id, status: "approved" },
    ];

    expect(decisionList(purchases, MARIA, [PRIMARY.id]).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("AC-APR-06: відхилення без причини — «Provide a reason»", () => {
    expect(validateDecision("reject", "   ")).toEqual({ ok: false, error: "Provide a reason" });
    expect(validateDecision("reject", " Немає бюджету ")).toEqual({ ok: true, decision: "reject", reason: "Немає бюджету" });
    expect(validateDecision("approve", "")).toEqual({ ok: true, decision: "approve", reason: null });
  });
});

describe("дія decidePurchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
  });

  it("AC-APR-02: Марія схвалює заявку — rpc decide_purchase і повернення на сторінку заявки", async () => {
    const { rpc } = setDb({});

    await expect(decidePurchase(form({ purchaseId: ID, decision: "approve" }))).rejects.toThrow(`REDIRECT /purchases/${ID}`);
    expect(rpc).toHaveBeenCalledWith("decide_purchase", { p_purchase_id: ID, p_decision: "approve", p_reason: null });
  });

  it("AC-APR-07: Марія відхиляє з причиною «Немає бюджету» — причину передано в базу", async () => {
    const { rpc } = setDb({});

    await expect(
      decidePurchase(form({ purchaseId: ID, decision: "reject", reason: "Немає бюджету" })),
    ).rejects.toThrow(`REDIRECT /purchases/${ID}`);
    expect(rpc).toHaveBeenCalledWith("decide_purchase", { p_purchase_id: ID, p_decision: "reject", p_reason: "Немає бюджету" });
  });

  it("AC-APR-06: відхилення без причини не доходить до бази — «Provide a reason»", async () => {
    const { rpc } = setDb({});

    await expect(decidePurchase(form({ purchaseId: ID, decision: "reject", reason: "" }))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?error=${encodeURIComponent("Provide a reason")}`,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-LANG-05: відмова бази REASON_REQUIRED показана англійською «Provide a reason»", async () => {
    setDb({ rpcError: { message: "REASON_REQUIRED" } });

    await expect(
      decidePurchase(form({ purchaseId: ID, decision: "reject", reason: "x" })),
    ).rejects.toThrow(`?error=${encodeURIComponent("Provide a reason")}`);
  });

  it("AC-APR-05: відмова бази FORBIDDEN (власна заявка напряму) — «Not enough permissions»", async () => {
    setDb({ rpcError: { message: "FORBIDDEN" } });

    await expect(decidePurchase(form({ purchaseId: ID, decision: "approve" }))).rejects.toThrow(
      `?error=${encodeURIComponent(MESSAGES.forbidden)}`,
    );
  });

  it("вже вирішену заявку (NOT_PENDING) — повернення на сторінку без помилки", async () => {
    setDb({ rpcError: { message: "NOT_PENDING" } });

    await expect(decidePurchase(form({ purchaseId: ID, decision: "approve" }))).rejects.toThrow(
      new RegExp(`REDIRECT /purchases/${ID}$`),
    );
  });

  it("гість не вирішує — сторінка входу", async () => {
    vi.mocked(getViewer).mockResolvedValue(null);
    const { rpc } = setDb({});

    await expect(decidePurchase(form({ purchaseId: ID, decision: "approve" }))).rejects.toThrow("REDIRECT /login");
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("сторінки рішення", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-APR-04: працівник 1 з роллю requester на списку для рішення бачить «Not enough permissions», жодної заявки", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1, "requester"));
    setDb({ purchases: [row()] });

    const html = renderToStaticMarkup(await ApprovalsPage());

    expect(html).toContain("Not enough permissions");
    expect(html).not.toContain("decision-list");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("AC-APR-01: Марія бачить у списку для рішення заявки свого відділу", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
    setDb({ purchases: [row(), row({ id: "00000000-0000-4000-8000-0000000000c2" })], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await ApprovalsPage());

    expect(html.match(/href="\/purchases\//g)).toHaveLength(2);
    expect(html).toContain("Awaiting approval");
  });

  it("AC-APR-08: у списку для рішення Марія бачить автора заявки", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
    const { rpc } = setDb({ purchases: [row()], approves: [PRIMARY.id] });
    rpc.mockResolvedValue({ data: [{ purchase_id: ID, author_name: "Andrii Demo-First" }], error: null });

    const html = renderToStaticMarkup(await ApprovalsPage());

    expect(html).toContain("Author:</span> Andrii Demo-First");
    expect(rpc).toHaveBeenCalledWith("purchase_author_names", { p_purchase_ids: [ID] });
  });

  it("порожній список для рішення — «No requests awaiting your decision»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
    setDb({ purchases: [], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await ApprovalsPage());

    expect(html).toContain("No requests awaiting your decision");
  });

  it("AC-APR-02: на сторінці заявки свого відділу Марія бачить кнопки «Approve» і «Reject»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
    setDb({ purchases: [row()], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(pageProps()));

    expect(html).toContain("decision-form");
    expect(html).toContain("Approve");
    expect(html).toContain("Reject");
  });

  it("AC-APR-05: схвалювач-автор не бачить кнопок рішення для власної заявки", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
    setDb({ purchases: [row({ author_id: MARIA })], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(pageProps()));

    expect(html).not.toContain("decision-form");
  });

  it("AC-APR-07: на сторінці відхиленої заявки причину «Немає бюджету» показано поруч зі статусом «Rejected»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(P1));
    setDb({ purchases: [row({ status: "rejected", rejection_reason: "Немає бюджету" })] });

    const html = renderToStaticMarkup(await PurchasePage(pageProps()));

    expect(html).toContain(`data-testid="purchase-status">Rejected<`);
    expect(html).toContain(`data-testid="rejection-reason">Немає бюджету<`);
    expect(html).not.toContain("decision-form");
  });

  it("AC-APR-06: після відхилення без причини на сторінці — «Provide a reason», статус «Awaiting approval»", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
    setDb({ purchases: [row()], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(pageProps({ error: "Provide a reason" })));

    expect(html).toContain("Provide a reason");
    expect(html).toContain(`data-testid="purchase-status">Awaiting approval<`);
  });

  it("довільний текст у ?error= не показуємо", async () => {
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
    setDb({ purchases: [row()], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(pageProps({ error: "Click here to win" })));

    expect(html).not.toContain("Click here to win");
  });
});

describe("підтвердження після рішення", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getViewer).mockResolvedValue(viewer(MARIA, "approver"));
  });

  it("після схвалення — повернення на сторінку заявки з ?decided=approve", async () => {
    setDb({});

    await expect(decidePurchase(form({ purchaseId: ID, decision: "approve" }))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?decided=approve`,
    );
  });

  it("після відхилення з причиною — ?decided=reject", async () => {
    setDb({});

    await expect(
      decidePurchase(form({ purchaseId: ID, decision: "reject", reason: "Немає бюджету" })),
    ).rejects.toThrow(`REDIRECT /purchases/${ID}?decided=reject`);
  });

  it("сторінка схваленої заявки з ?decided=approve показує «Request approved»", async () => {
    setDb({ purchases: [row({ status: "approved" })], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(pageProps({ decided: "approve" })));

    expect(html).toContain('data-testid="decision-done"');
    expect(html).toContain("Request approved");
  });

  it("підтвердження не показуємо, якщо статус заявки з ним не збігається (адресі не довіряємо)", async () => {
    setDb({ purchases: [row()], approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(pageProps({ decided: "approve" })));

    expect(html).not.toContain("Request approved");
  });
});

