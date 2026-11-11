import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decidePurchase, resubmitPurchase } from "@/app/purchases/actions";
import EditPurchasePage from "@/app/purchases/[id]/edit/page";
import PurchasePage from "@/app/purchases/[id]/page";
import { MESSAGES } from "@/lib/org/messages";
import { canEditReturned, validateDecision } from "@/lib/purchases/decisions";
import { STATUS_LABELS, validateLines } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { form, P1, P2, PRIMARY, viewer } from "./fake-db";
import { signIn, withViewer } from "../support/viewer";

// Повернення на доопрацювання й повторне подання (AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-LANG-09): доменні правила, дії
// decidePurchase (рішення return) і resubmitPurchase, сторінка заявки (причина повернення, «Return for revision»,
// «Edit») і сторінка редагування. Правила в базі доводить tests/db/return-for-revision.test.ts.

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const ID = "00000000-0000-4000-8000-0000000000c1";
const MARIA = P2; // схвалює «Primary School»
const REASON = "Уточніть кількість";
const LINES = [
  { id: "00000000-0000-4000-8000-0000000000e1", position: 1, name: "Paper A4", purpose: "Printing", quantity: 3, unit_price: 20, status: "pending" },
  { id: "00000000-0000-4000-8000-0000000000e2", position: 2, name: "Pens", purpose: "Classes", quantity: 2, unit_price: 15.5, status: "pending" },
];
// Автор виправив рядок 1: кількість 3 → 5.
const FIXED = JSON.stringify([
  { name: "Paper A4", purpose: "Printing", quantity: "5", unitPrice: "20.00" },
  { name: "Pens", purpose: "Classes", quantity: "2", unitPrice: "15.50" },
]);

const purchase = (status: string, returnReason: string | null) => ({
  id: ID,
  author_id: P1,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status,
  rejection_reason: null,
  return_reason: returnReason,
  created_at: "2026-11-05T19:32:00Z",
  number: 7,
});

// Колонки, з якими сторінка читала purchases, — щоб перевірити повторне читання без return_reason.
let purchaseColumns: string[] = [];

function setDb({
  status = "returned",
  returnReason = REASON as string | null,
  visible = true,
  approves = [] as readonly string[],
  missingReturnReason = false,
  rpcError = null as { code?: string; message: string } | null,
} = {}) {
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const rpc = vi.fn((fn: string) =>
    fn === "decide_purchase" || fn === "resubmit_purchase" ? Promise.resolve({ data: null, error: rpcError }) : ok([]),
  );
  const client = {
    rpc,
    from: vi.fn((table: string) => {
      switch (table) {
        case "purchases":
          return {
            select: (columns: string) => ({
              eq: () => ({
                maybeSingle: () => {
                  purchaseColumns.push(columns);
                  if (missingReturnReason && columns.includes("return_reason"))
                    return Promise.resolve({ data: null, error: { code: "42703", message: "column return_reason does not exist" } });
                  return ok(visible ? purchase(status, returnReason) : null);
                },
              }),
            }),
          };
        case "purchase_lines":
          return { select: () => ({ eq: () => ({ order: () => ok(visible ? LINES : []) }) }) };
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

const props = (searchParams: Record<string, string> = {}) =>
  ({ params: Promise.resolve({ id: ID }), searchParams: Promise.resolve(searchParams) }) as never;
const renderPage = async (searchParams: Record<string, string> = {}) =>
  renderToStaticMarkup(await PurchasePage(props(searchParams)));
const renderEdit = async () => renderToStaticMarkup(await EditPurchasePage(props()));
// Тег із атрибутами в будь-якому порядку: React сам обирає порядок атрибутів.
const tag = (html: string, name: string, attribute: string) =>
  [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))].map((m) => m[0]).find((t) => t.includes(attribute)) ?? "";
const text = (html: string, testId: string) =>
  [...html.matchAll(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`, "g"))].map((m) => m[1]);

beforeEach(() => {
  vi.clearAllMocks();
  purchaseColumns = [];
});

describe("повернення — доменні правила", () => {
  it("AC-DEC-04: повернення з причиною — рішення return з причиною без пробілів по краях, без позначених рядків", () => {
    expect(validateDecision("return", `  ${REASON} `, [LINES[0].id])).toEqual({
      ok: true,
      decision: "return",
      reason: REASON,
      rejectedLines: [],
    });
  });

  it("AC-DEC-06: повернення без причини — «Provide a reason»", () => {
    for (const reason of ["", "   "]) {
      expect(validateDecision("return", reason)).toEqual({ ok: false, error: MESSAGES.provideReason });
    }
  });

  it("AC-DEC-07: редагує й подає знову лише автор і лише повернену заявку", () => {
    expect(canEditReturned({ id: P1 }, { authorId: P1, status: "returned" })).toBe(true);
    expect(canEditReturned({ id: MARIA }, { authorId: P1, status: "returned" })).toBe(false);
    for (const status of ["awaiting_approval", "approved", "partially_approved", "rejected"]) {
      expect(canEditReturned({ id: P1 }, { authorId: P1, status })).toBe(false);
    }
  });

  it("AC-DEC-07: рядки при повторному поданні — ті самі перевірки, що вперше", () => {
    const paper = { name: "Paper A4", purpose: "Printing", quantity: "5", unitPrice: "20.00" };
    expect(validateLines([paper])).toEqual({ ok: true });
    expect(validateLines([])).toEqual({ ok: false, error: MESSAGES.noLines });
    expect(validateLines([{ ...paper, purpose: " " }])).toEqual({ ok: false, error: MESSAGES.lineFields });
    // Кожен рядок, а не хоча б один.
    expect(validateLines([paper, { ...paper, unitPrice: "" }])).toEqual({ ok: false, error: MESSAGES.lineFields });
  });

  it("AC-LANG-09: статус «Повернено на доопрацювання» підписано текстом «Returned for revision»", () => {
    expect(STATUS_LABELS.returned).toBe("Returned for revision");
  });
});

describe("повернення — дія decidePurchase", () => {
  beforeEach(() => signIn(viewer(MARIA, "approver")));

  it("AC-DEC-04: Марія повертає заявку з причиною «Уточніть кількість» — rpc return і повернення на сторінку заявки", async () => {
    const { rpc } = setDb({ status: "awaiting_approval", returnReason: null });

    await expect(decidePurchase(form({ purchaseId: ID, decision: "return", reason: REASON }))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?decided=return`,
    );
    expect(rpc).toHaveBeenCalledWith("decide_purchase", { p_purchase_id: ID, p_decision: "return", p_reason: REASON });
  });

  it("AC-DEC-06: Марія повертає заявку без причини — «Provide a reason», до бази не доходить", async () => {
    const { rpc } = setDb({ status: "awaiting_approval", returnReason: null });

    await expect(decidePurchase(form({ purchaseId: ID, decision: "return", reason: "  " }))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?error=${encodeURIComponent(MESSAGES.provideReason)}`,
    );
    expect(rpc).not.toHaveBeenCalledWith("decide_purchase", expect.anything());
  });

  it("AC-DEC-06: відмова бази REASON_REQUIRED (обхід перевірки сторінки) — те саме «Provide a reason»", async () => {
    setDb({ status: "awaiting_approval", returnReason: null, rpcError: { message: "REASON_REQUIRED" } });

    await expect(decidePurchase(form({ purchaseId: ID, decision: "return", reason: REASON }))).rejects.toThrow(
      `REDIRECT /purchases/${ID}?error=${encodeURIComponent(MESSAGES.provideReason)}`,
    );
  });
});

describe("повторне подання — дія resubmitPurchase", () => {
  beforeEach(() => signIn(viewer(P1)));

  it("AC-DEC-07: автор виправив рядок 1 і подає знову — rpc resubmit_purchase і «Мої заявки» з «Purchase submitted»", async () => {
    const { rpc } = setDb();

    await expect(resubmitPurchase({}, form({ purchaseId: ID, lines: FIXED }))).rejects.toThrow(
      "REDIRECT /purchases?submitted=1",
    );
    expect(rpc).toHaveBeenCalledWith("resubmit_purchase", {
      p_purchase_id: ID,
      p_lines: [
        { name: "Paper A4", purpose: "Printing", quantity: "5", unit_price: "20.00" },
        { name: "Pens", purpose: "Classes", quantity: "2", unit_price: "15.50" },
      ],
    });
  });

  it("AC-DEC-07: без рядків — «Add at least one line», до бази не доходить", async () => {
    const { rpc } = setDb();

    expect(await resubmitPurchase({}, form({ purchaseId: ID, lines: "[]" }))).toEqual({ error: MESSAGES.noLines });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("AC-DEC-07: відмова бази FORBIDDEN (не автор чи не повернена) — «Not enough permissions», без переходу", async () => {
    setDb({ rpcError: { message: "FORBIDDEN" } });

    expect(await resubmitPurchase({}, form({ purchaseId: ID, lines: FIXED }))).toEqual({ error: MESSAGES.forbidden });
  });

  it("AC-DEC-07: id заявки не з адреси застосунку — «Not enough permissions», до бази не доходить", async () => {
    const { rpc } = setDb();

    expect(await resubmitPurchase({}, form({ purchaseId: "1; drop", lines: FIXED }))).toEqual({
      error: MESSAGES.forbidden,
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("невідома помилка бази не видається за успіх", async () => {
    setDb({ rpcError: { message: "connection reset" } });

    await expect(resubmitPurchase({}, form({ purchaseId: ID, lines: FIXED }))).rejects.toThrow(/connection reset/);
  });

  it("гість не подає знову — сторінка входу", async () => {
    signIn(null);
    setDb();

    await expect(resubmitPurchase({}, form({ purchaseId: ID, lines: FIXED }))).rejects.toThrow("REDIRECT /login");
  });
});

describe("повернення — сторінка заявки", () => {
  it("AC-DEC-04: автор бачить статус «Returned for revision», причину «Уточніть кількість» і кнопку «Edit»", async () => {
    signIn(viewer(P1));
    setDb();

    const html = await renderPage();

    expect(text(html, "purchase-status")).toEqual(["Returned for revision"]);
    expect(text(html, "return-reason")).toEqual([REASON]);
    expect(tag(html, "a", 'data-testid="edit-purchase"')).toContain(`href="/purchases/${ID}/edit"`);
  });

  it("AC-LANG-09: на сторінці заявки статус підписано текстом «Returned for revision»", async () => {
    signIn(viewer(MARIA, "approver"));
    setDb({ approves: [PRIMARY.id] });

    const html = await renderPage();

    expect(text(html, "purchase-status")).toEqual(["Returned for revision"]);
    // Схвалювач бачить причину, але не «Edit» і не форму рішення: заявка вже не чекає.
    expect(text(html, "return-reason")).toEqual([REASON]);
    expect(html).not.toContain('data-testid="edit-purchase"');
    expect(html).not.toContain('data-testid="decision-form"');
  });

  it("AC-DEC-04: Марія бачить кнопку «Return for revision» у формі рішення", async () => {
    signIn(viewer(MARIA, "approver"));
    setDb({ status: "awaiting_approval", returnReason: null, approves: [PRIMARY.id] });

    const html = await renderPage();

    const button = tag(html, "button", 'value="return"');
    expect(button).toContain('name="decision"');
    expect(html).toContain(`${button}Return for revision</button>`);
    expect(text(html, "return-reason")).toEqual([]);
  });

  it("AC-DEC-04: після повернення — підтвердження «Request returned for revision»", async () => {
    signIn(viewer(MARIA, "approver"));
    setDb({ approves: [PRIMARY.id] });

    expect(text(await renderPage({ decided: "return" }), "decision-done")).toEqual(["Request returned for revision"]);
  });

  it("AC-DEC-07: автор заявки, що чекає, не бачить «Edit»", async () => {
    signIn(viewer(P1));
    setDb({ status: "awaiting_approval", returnReason: null });

    expect(await renderPage()).not.toContain('data-testid="edit-purchase"');
  });

  it("поки колонки return_reason немає в базі (42703) — сторінка без причини, а не помилка", async () => {
    signIn(viewer(P1));
    setDb({ status: "awaiting_approval", returnReason: null, missingReturnReason: true });

    const html = await renderPage();

    expect(text(html, "purchase-status")).toEqual(["Awaiting approval"]);
    expect(purchaseColumns).toHaveLength(2);
    expect(purchaseColumns[1]).not.toContain("return_reason");
  });
});

describe("повторне подання — сторінка редагування", () => {
  it("AC-DEC-07: автор поверненої заявки бачить її рядки у формі, відділ і причину повернення", async () => {
    signIn(viewer(P1));
    setDb();

    const html = await renderEdit();

    expect(html).toContain('data-testid="resubmit-form"');
    expect(text(html, "purchase-department")).toEqual([PRIMARY.name]);
    expect(text(html, "return-reason")).toEqual([REASON]);
    for (const value of ["Paper A4", "Printing", "3", "20.00", "Pens", "Classes", "2", "15.50"]) {
      expect(html).toContain(`value="${value}"`);
    }
    expect(html).toContain(`name="purchaseId" value="${ID}"`);
  });

  it("AC-DEC-07: Марія, автор заявки, що не повернена, і чужий працівник — «Not enough permissions» без даних", async () => {
    for (const [who, state] of [
      [viewer(MARIA, "approver"), { approves: [PRIMARY.id] }],
      [viewer(P1), { status: "rejected", returnReason: null }],
      [viewer(P1), { visible: false }],
    ] as const) {
      signIn(who);
      setDb(state);

      const html = await renderEdit();

      expect(text(html, "no-access")).toEqual([MESSAGES.forbidden]);
      expect(html).not.toContain("Paper A4");
    }
  });

  it("гість — сторінка входу", async () => {
    signIn(null);
    setDb();

    await expect(EditPurchasePage(props())).rejects.toThrow("REDIRECT /login");
  });
});
