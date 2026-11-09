import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decidePurchase } from "@/app/purchases/actions";
import PurchasePage from "@/app/purchases/[id]/page";
import { MESSAGES } from "@/lib/org/messages";
import { validateDecision } from "@/lib/purchases/decisions";
import { LINE_STATUS_LABELS, STATUS_LABELS } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { form, P1, P2, PRIMARY, viewer } from "./fake-db";
import { signIn, withViewer } from "../support/viewer";

// Часткове схвалення (AC-DEC-01): доменна перевірка рішення з відхиленими рядками, дія decidePurchase і сторінка
// заявки зі статусами рядків і позначкою «Reject line». Саме правило статусів доводить тест бази
// (tests/db/partial-approval.test.ts); тут — що застосунок передає позначені рядки й показує результат.

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const ID = "00000000-0000-4000-8000-0000000000c1";
const L1 = "00000000-0000-4000-8000-0000000000e1";
const L2 = "00000000-0000-4000-8000-0000000000e2";
const L3 = "00000000-0000-4000-8000-0000000000e3";
const MARIA = P2; // схвалює «Primary School»
const MISSING_COLUMN = { code: "42703", message: "column purchase_lines.status does not exist" };

const purchase = (status: string) => ({
  id: ID,
  author_id: P1,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status,
  rejection_reason: null,
  created_at: "2026-11-05T19:32:00Z",
  number: 7,
});
const lines = (statuses: string[]) =>
  [
    { id: L1, position: 1, name: "Paper A4", purpose: "Classes", quantity: 2, unit_price: 5 },
    { id: L2, position: 2, name: "Pens", purpose: "Classes", quantity: 2, unit_price: 5 },
    { id: L3, position: 3, name: "Markers", purpose: "Classes", quantity: 2, unit_price: 5 },
  ].map((l, i) => ({ ...l, status: statuses[i] }));

// Колонки, з якими сторінка читала purchase_lines, — щоб перевірити повторне читання без статусу.
let lineColumns: string[] = [];

function setDb({
  status = "awaiting_approval",
  lineStatuses = ["pending", "pending", "pending"],
  approves = [] as string[],
  missingLineStatus = false,
  rpcError = null as { code?: string; message: string } | null,
} = {}) {
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const rpc = vi.fn((fn: string) => (fn === "decide_purchase" ? Promise.resolve({ data: null, error: rpcError }) : ok([])));
  const client = {
    rpc,
    from: vi.fn((table: string) => {
      switch (table) {
        case "purchases":
          return { select: () => ({ eq: () => ({ maybeSingle: () => ok(purchase(status)) }) }) };
        case "purchase_lines":
          return {
            select: (columns: string) => ({
              eq: () => ({
                order: () => {
                  lineColumns.push(columns);
                  if (missingLineStatus && columns.includes("status"))
                    return Promise.resolve({ data: null, error: MISSING_COLUMN });
                  const rows = lines(lineStatuses);
                  // Рядок, яким його віддає база без колонки status (до міграції).
                  const withoutStatus = rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== "status")));
                  return ok(columns.includes("status") ? rows : withoutStatus);
                },
              }),
            }),
          };
        case "department_members":
          return { select: () => ({ eq: () => ({ eq: () => ok(approves.map((d) => ({ department_id: d }))) }) }) };
        case "departments":
          return { select: () => ({ eq: () => ({ maybeSingle: () => ok({ name: PRIMARY.name }) }) }) };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  vi.mocked(createClient).mockResolvedValue(withViewer(client) as never);
  return { rpc };
}

const pageProps = (searchParams: Record<string, string> = {}) =>
  ({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve(searchParams) }) as never;
const render = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(await PurchasePage(pageProps(searchParams)));
const cells = (html: string, testId: string) =>
  [...html.matchAll(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`, "g"))].map((m) => m[1]);
const checkboxes = (html: string) =>
  [...html.matchAll(/<input[^>]*data-testid="reject-line"[^>]*>/g)].map((m) => m[0]);

function decisionForm(fields: Record<string, string>, rejectedLines: string[]) {
  const data = form(fields);
  for (const id of rejectedLines) data.append("rejectedLines", id);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  lineColumns = [];
});

describe("часткове схвалення — доменні правила", () => {
  it("AC-DEC-01: схвалення з позначеним рядком 2 — рішення approve і рядок 2 серед відхилених", () => {
    expect(validateDecision("approve", "", [L2])).toEqual({ ok: true, decision: "approve", reason: null, rejectedLines: [L2] });
    expect(validateDecision("approve", "")).toEqual({ ok: true, decision: "approve", reason: null, rejectedLines: [] });
  });

  it("AC-DEC-01: відхилення заявки цілком не бере позначених рядків — відхиляються всі", () => {
    expect(validateDecision("reject", " Немає бюджету ", [L2])).toEqual({
      ok: true,
      decision: "reject",
      reason: "Немає бюджету",
      rejectedLines: [],
    });
  });

  it("AC-DEC-01: позначений рядок — не id рядка — «Not enough permissions»", () => {
    expect(validateDecision("approve", "", [L2, "2"])).toEqual({ ok: false, error: MESSAGES.forbidden });
  });

  it("AC-DEC-01: статуси підписано текстом — «Partially approved», рядки «Approved» і «Rejected»", () => {
    expect(STATUS_LABELS.partially_approved).toBe("Partially approved");
    expect(LINE_STATUS_LABELS).toEqual({ approved: "Approved", rejected: "Rejected" });
  });
});

describe("часткове схвалення — дія decidePurchase", () => {
  beforeEach(() => signIn(viewer(MARIA, "approver")));

  it("AC-DEC-01: Марія відхиляє рядок 2 і схвалює — rpc з p_rejected_lines і повернення на сторінку заявки", async () => {
    const { rpc } = setDb();

    await expect(decidePurchase(decisionForm({ purchaseId: ID, decision: "approve" }, [L2]))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?decided=approve`,
    );
    expect(rpc).toHaveBeenCalledWith("decide_purchase", {
      p_purchase_id: ID,
      p_decision: "approve",
      p_reason: null,
      p_rejected_lines: [L2],
    });
  });

  it("AC-DEC-01: без позначених рядків — виклик із трьома аргументами, як у зрізі 2 (працює й до db-deploy)", async () => {
    const { rpc } = setDb();

    await expect(decidePurchase(decisionForm({ purchaseId: ID, decision: "approve" }, []))).rejects.toThrow("REDIRECT");
    expect(rpc).toHaveBeenCalledWith("decide_purchase", { p_purchase_id: ID, p_decision: "approve", p_reason: null });
  });

  it("усі рядки відхилено (ALL_LINES_REJECTED) — «All lines are rejected: reject the whole request»", async () => {
    setDb({ rpcError: { code: "P0001", message: "ALL_LINES_REJECTED" } });

    await expect(decidePurchase(decisionForm({ purchaseId: ID, decision: "approve" }, [L1, L2, L3]))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?error=${encodeURIComponent(MESSAGES.allLinesRejected)}`,
    );
  });

  it("поки нової функції немає в базі (PGRST202) — текст помилки замість падіння сторінки", async () => {
    setDb({ rpcError: { code: "PGRST202", message: "Could not find the function public.decide_purchase" } });

    await expect(decidePurchase(decisionForm({ purchaseId: ID, decision: "approve" }, [L2]))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?error=${encodeURIComponent(MESSAGES.decisionUnavailable)}`,
    );
  });
});

describe("часткове схвалення — сторінка заявки", () => {
  it("AC-DEC-01: автор бачить «Partially approved», рядок 2 «Rejected», рядки 1 і 3 «Approved»", async () => {
    signIn(viewer(P1));
    setDb({ status: "partially_approved", lineStatuses: ["approved", "rejected", "approved"] });

    const html = await render();

    expect(cells(html, "purchase-status")).toEqual(["Partially approved"]);
    expect(cells(html, "line-status")).toEqual(["Approved", "Rejected", "Approved"]);
    expect(checkboxes(html)).toEqual([]);
    // Сума заявки — за всіма рядками, зокрема для «Partially approved» (#65).
    expect(cells(html, "purchase-total")).toEqual(["30.00"]);
  });

  it("AC-DEC-01: Марія бачить біля кожного рядка позначку «Reject line» у формі рішення", async () => {
    signIn(viewer(MARIA, "approver"));
    setDb({ approves: [PRIMARY.id] });

    const html = await render();

    const boxes = checkboxes(html);
    expect(boxes).toHaveLength(3);
    for (const [i, id] of [L1, L2, L3].entries()) {
      expect(boxes[i]).toContain(`value="${id}"`);
      expect(boxes[i]).toContain('name="rejectedLines"');
      expect(boxes[i]).toContain('form="decision-form"');
    }
    expect(html).toContain("Reject line");
    // До рішення статусів рядків немає.
    expect(cells(html, "line-status")).toEqual([]);
  });

  it("AC-DEC-01: автор заявки, що чекає, не бачить ні позначок, ні статусів рядків", async () => {
    signIn(viewer(P1));
    setDb();

    const html = await render();

    expect(checkboxes(html)).toEqual([]);
    expect(cells(html, "line-status")).toEqual([]);
  });

  it("AC-DEC-01: після часткового схвалення — підтвердження «Request partially approved»", async () => {
    signIn(viewer(MARIA, "approver"));
    setDb({ status: "partially_approved", lineStatuses: ["approved", "rejected", "approved"], approves: [PRIMARY.id] });

    const html = await render({ decided: "approve" });

    expect(cells(html, "decision-done")).toEqual(["Request partially approved"]);
  });

  it("AC-DEC-01: поки колонки статусу рядка немає в базі (42703) — рядки без статусу, а не помилка", async () => {
    signIn(viewer(P1));
    setDb({ missingLineStatus: true });

    const html = await render();

    expect(html).toContain("Markers");
    expect(cells(html, "line-status")).toEqual([]);
    expect(lineColumns).toHaveLength(2);
    expect(lineColumns[1]).not.toContain("status");
  });
});
