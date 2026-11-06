import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyRequestsPage from "@/app/purchases/page";
import PurchasePage from "@/app/purchases/[id]/page";
import { formatCents, formatNumber, lineTotal, purchaseTotal } from "@/lib/purchases/amounts";
import { withNumber } from "@/lib/purchases/lists";
import { createClient } from "@/lib/supabase/server";
import { P1, PRIMARY, viewer } from "./fake-db";
import { signIn, withViewer } from "../support/viewer";

// Номер заявки (AC-HIST-01) і суми (AC-HIST-02): доменні функції, «My requests» і сторінка заявки. Номери видає база
// (tests/db/numbers.test.ts); тут — що застосунок показує їх і рахує суми в центах.

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const MISSING_COLUMN = { code: "42703", message: "column purchases.number does not exist" };
const ID1 = "00000000-0000-4000-8000-0000000000c1";
const ID2 = "00000000-0000-4000-8000-0000000000c2";
const row = (id: string, number: number, createdAt: string) => ({
  id,
  author_id: P1,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status: "awaiting_approval",
  created_at: createdAt,
  number,
});
const ok = <T>(data: T) => Promise.resolve({ data, error: null });
// Рядок, яким його віддає база без колонки number (до міграції).
const omitNumber = (r: object) => Object.fromEntries(Object.entries(r).filter(([key]) => key !== "number"));

// Колонки, з якими сторінка читала purchases, — щоб перевірити повторне читання без номера.
let selected: string[] = [];
const purchasesResult = (rows: unknown, columns: string, missingNumber: boolean) => {
  selected.push(columns);
  return missingNumber && columns.includes("number")
    ? Promise.resolve({ data: null, count: null, error: MISSING_COLUMN })
    : Promise.resolve({ data: rows, count: Array.isArray(rows) ? rows.length : null, error: null });
};

function setListDb(rows: ReturnType<typeof row>[], { missingNumber = false } = {}) {
  const strip = (columns: string) =>
    columns.includes("number") ? rows : rows.map(omitNumber);
  const client = {
    rpc: vi.fn(() => ok([])),
    from: vi.fn((table: string) => {
      if (table === "departments") return { select: () => ok([PRIMARY]) };
      if (table !== "purchases") throw new Error(`unexpected table ${table}`);
      return {
        select: (columns: string) => ({
          eq: () => ({ order: () => purchasesResult(strip(columns), columns, missingNumber) }),
        }),
      };
    }),
  };
  vi.mocked(createClient).mockResolvedValue(withViewer(client) as never);
}

function setPurchaseDb(
  lines: { position: number; name: string; purpose: string; quantity: number; unit_price: number }[],
  { number = 7, missingNumber = false } = {},
) {
  const purchase = { ...row(ID1, number, "2026-11-05T19:32:00Z"), rejection_reason: null };
  const client = {
    rpc: vi.fn(() => ok([{ purchase_id: ID1, author_name: "PM Demo Requester" }])),
    from: vi.fn((table: string) => {
      switch (table) {
        case "purchases":
          return {
            select: (columns: string) => ({
              eq: () => ({
                maybeSingle: () => {
                  selected.push(columns);
                  if (missingNumber && columns.includes("number")) return Promise.resolve({ data: null, error: MISSING_COLUMN });
                  return ok(columns.includes("number") ? purchase : omitNumber(purchase));
                },
              }),
            }),
          };
        case "purchase_lines":
          return { select: () => ({ eq: () => ({ order: () => ok(lines) }) }) };
        case "department_members":
          return { select: () => ({ eq: () => ({ eq: () => ok([]) }) }) };
        case "departments":
          return { select: () => ({ eq: () => ({ maybeSingle: () => ok({ name: PRIMARY.name }) }) }) };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  vi.mocked(createClient).mockResolvedValue(withViewer(client) as never);
}

const props = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }) as never;
const myRequests = async () =>
  renderToStaticMarkup(await MyRequestsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as never));
const cells = (html: string, testId: string) =>
  [...html.matchAll(new RegExp(`data-testid="${testId}">([^<]*)<`, "g"))].map((m) => m[1]);

const TWO_LINES = [
  { position: 1, name: "Paper A4", purpose: "Printing", quantity: 3, unit_price: 20 },
  { position: 2, name: "Pens", purpose: "Classes", quantity: 2, unit_price: 15.5 },
];

beforeEach(() => {
  vi.clearAllMocks();
  selected = [];
  signIn(viewer(P1));
});

describe("номер заявки й суми — доменні функції", () => {
  it("AC-HIST-01: номер показано як «PUR-» і число; без номера — «—»", () => {
    expect(formatNumber(1)).toBe("PUR-1");
    expect(formatNumber(1042)).toBe("PUR-1042");
    expect(formatNumber(null)).toBe("—");
    expect(formatNumber(undefined)).toBe("—");
    expect(formatNumber(0)).toBe("—");
    expect(formatNumber(1.5)).toBe("—");
  });

  it("AC-HIST-02: кількість 3 за 20.00 і 2 за 15.50 — суми рядків 60.00 і 31.00, сума заявки 91.00", () => {
    expect(formatCents(lineTotal(3, 20))).toBe("60.00");
    expect(formatCents(lineTotal(2, "15.50"))).toBe("31.00");
    expect(formatCents(purchaseTotal(TWO_LINES))).toBe("91.00");
  });

  it("AC-HIST-02: суми — у цілих центах, без похибки дробів; без кількості чи ціни — «—», у суму заявки не входить", () => {
    expect(lineTotal(3, 0.1)).toBe(30);
    expect(formatCents(lineTotal(3, 0.1))).toBe("0.30");
    expect(formatCents(lineTotal(1, "0.05"))).toBe("0.05");
    expect(formatCents(lineTotal(1, 1234.5))).toBe("1234.50");
    expect(lineTotal(null, 20)).toBeNull();
    expect(lineTotal(3, "")).toBeNull();
    expect(lineTotal(3, "abc")).toBeNull();
    expect(formatCents(null)).toBe("—");
    expect(formatCents(-150)).toBe("-1.50");
    expect(formatCents(0)).toBe("0.00");
    expect(lineTotal(undefined, 20)).toBeNull();
    expect(purchaseTotal([{ quantity: 2, unit_price: 1 }, { quantity: null, unit_price: 5 }])).toBe(200);
    expect(purchaseTotal([])).toBe(0);
  });
});

describe("номер заявки в «My requests»", () => {
  it("AC-HIST-01: працівник 1 подав першу закупівлю, а потім другу — у списку «Мої заявки» номери «PUR-1» і «PUR-2»", async () => {
    setListDb([row(ID2, 2, "2026-11-05T15:00:00Z"), row(ID1, 1, "2026-11-05T14:00:00Z")]);

    const html = await myRequests();

    expect(cells(html, "purchase-number")).toEqual(["PUR-2", "PUR-1"]);
  });

  it("AC-HIST-01: поки міграції номера немає в базі (42703) — список без номера, «—», а не помилка", async () => {
    setListDb([row(ID1, 1, "2026-11-05T14:00:00Z")], { missingNumber: true });

    const html = await myRequests();

    expect(cells(html, "purchase-number")).toEqual(["—"]);
    expect(selected).toHaveLength(2);
    expect(selected[1]).not.toContain("number");
  });

  it("AC-HIST-01: інша помилка бази не ховається за «—»", async () => {
    const read = vi.fn(() => Promise.resolve({ data: null, count: null, error: { code: "42501", message: "denied" } }));

    const result = await withNumber(read, "id");

    expect(result.error?.code).toBe("42501");
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe("номер і суми на сторінці заявки", () => {
  it("AC-HIST-02: автор відкриває заявку з рядками 3 × 20.00 і 2 × 15.50 — суми рядків 60.00 і 31.00, сума заявки 91.00", async () => {
    setPurchaseDb(TWO_LINES);

    const html = renderToStaticMarkup(await PurchasePage(props(ID1)));

    expect(cells(html, "line-total")).toEqual(["60.00", "31.00"]);
    expect(cells(html, "purchase-total")).toEqual(["91.00"]);
    expect(html).toContain("Line total");
    expect(html).toContain("Total");
  });

  it("AC-HIST-01: на сторінці заявки — її номер «PUR-7»", async () => {
    setPurchaseDb(TWO_LINES, { number: 7 });

    const html = renderToStaticMarkup(await PurchasePage(props(ID1)));

    expect(cells(html, "purchase-number")).toEqual(["PUR-7"]);
  });

  it("AC-HIST-01: поки міграції номера немає в базі (42703) — сторінка заявки з «—» замість номера", async () => {
    setPurchaseDb(TWO_LINES, { missingNumber: true });

    const html = renderToStaticMarkup(await PurchasePage(props(ID1)));

    expect(cells(html, "purchase-number")).toEqual(["—"]);
    expect(cells(html, "purchase-total")).toEqual(["91.00"]);
    expect(selected[1]).not.toContain("number");
  });
});
