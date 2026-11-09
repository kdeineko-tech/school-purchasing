import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyRequestsPage from "@/app/purchases/page";
import PurchasePage from "@/app/purchases/[id]/page";
import { canSeePurchase } from "@/lib/purchases/form";
import { createClient } from "@/lib/supabase/server";
import { ADMIN, fakeDb, P1, P2, PRIMARY, viewer } from "./fake-db";
import { signIn, withViewer } from "../support/viewer";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
}));

const PURCHASE_ID = "00000000-0000-4000-8000-0000000000c1";
const purchase = (status = "awaiting_approval") => ({
  id: PURCHASE_ID,
  author_id: P1,
  department_id: PRIMARY.id,
  purchase_type: "purchasing_department",
  status,
  created_at: "2026-10-25T15:00:00Z",
});
const line = { position: 1, name: "Paper A4", purpose: "Printing", quantity: 3, unit_price: 20 };

// Підставний Supabase для сторінки закупівлі: visible — що повертає RLS (null — чужа закупівля не видна).
function setPurchaseDb({
  visible,
  approves = [],
  departmentError = null,
  authorName = "Andrii Demo-First",
  authorError = null,
  history = [],
  historyError = null,
}: {
  visible: ReturnType<typeof purchase> | null;
  approves?: string[];
  departmentError?: { message: string } | null;
  authorName?: string;
  authorError?: { code: string; message: string } | null;
  history?: { kind: string; created_at: string; actor_name: string }[];
  historyError?: { code: string; message: string } | null;
}) {
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });
  const client = {
    // purchase_author_names віддає ім'я лише для видимої заявки (міграція 20261026155141_purchase_author_names.sql);
    // purchase_history — записи лише видимої заявки (20261109144820_purchase_history.sql).
    rpc: vi.fn((fn: string, args: { p_purchase_ids?: string[]; p_purchase_id?: string }) => {
      if (fn === "purchase_history") {
        if (historyError) return Promise.resolve({ data: null, error: historyError });
        return ok(visible && args.p_purchase_id === visible.id ? history : []);
      }
      if (authorError) return Promise.resolve({ data: null, error: authorError });
      return ok(
        visible && args.p_purchase_ids?.includes(visible.id) ? [{ purchase_id: visible.id, author_name: authorName }] : [],
      );
    }),
    from: vi.fn((table: string) => {
      switch (table) {
        case "purchases":
          return { select: () => ({ eq: () => ({ maybeSingle: () => ok(visible) }) }) };
        case "purchase_lines":
          return { select: () => ({ eq: () => ({ order: () => ok(visible ? [line] : []) }) }) };
        case "department_members":
          return { select: () => ({ eq: () => ({ eq: () => ok(approves.map((d) => ({ department_id: d }))) }) }) };
        case "departments":
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () =>
                  Promise.resolve(departmentError ? { data: null, error: departmentError } : { data: { name: PRIMARY.name }, error: null }),
              }),
            }),
          };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  vi.mocked(createClient).mockResolvedValue(withViewer(client) as never);
  return client;
}

const props = (id: string) => ({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }) as never;

describe("сторінка закупівлі", () => {
  beforeEach(() => {
    // Лише історія викликів: підставні значення (mockResolvedValue) кожен тест задає сам.
    vi.clearAllMocks();
    signIn(viewer(P1));
  });

  it("AC-FRM-08: працівник 2 (заявник відділу, не автор і не схвалювач) бачить «Not enough permissions», даних закупівлі немає", async () => {
    signIn(viewer(P2));
    setPurchaseDb({ visible: null });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain("Not enough permissions");
    expect(html).not.toContain("Paper A4");
    expect(html).not.toContain(PRIMARY.name);
  });

  it("AC-FRM-08: правило видимості — автор, схвалювач відділу, адміністратор; колега-заявник — ні", () => {
    const p = { authorId: P1, departmentId: PRIMARY.id };

    expect(canSeePurchase({ id: P2, role: "requester" }, p, [])).toBe(false);
    expect(canSeePurchase({ id: P1, role: "requester" }, p, [])).toBe(true);
    expect(canSeePurchase({ id: P2, role: "approver" }, p, [PRIMARY.id])).toBe(true);
    expect(canSeePurchase({ id: ADMIN, role: "admin" }, p, [])).toBe(true);
  });

  it("AC-LANG-06: на сторінці заявки статус підписано текстом «Awaiting approval»", async () => {
    setPurchaseDb({ visible: purchase() });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toMatch(/data-testid="purchase-status">Awaiting approval</);
    expect(html).toContain("Paper A4");
    expect(html).toContain("20.00");
  });

  it("AC-LANG-06: статуси «Approved» і «Rejected» підписано текстом", async () => {
    for (const [status, label] of [
      ["approved", "Approved"],
      ["rejected", "Rejected"],
    ]) {
      setPurchaseDb({ visible: purchase(status) });
      const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));
      expect(html).toContain(`data-testid="purchase-status">${label}<`);
    }
  });

  it("AC-LANG-06: у «Мої заявки» статус підписано текстом", async () => {
    const db = fakeDb({ departments: [PRIMARY], purchases: [{ ...purchase(), author_id: P1 }] });
    vi.mocked(createClient).mockResolvedValue(withViewer(db.client) as never);

    const html = renderToStaticMarkup(
      await MyRequestsPage({ params: Promise.resolve({}), searchParams: Promise.resolve({}) } as never),
    );

    expect(html).toContain(`data-testid="purchase-status">Awaiting approval<`);
    expect(html).toContain(`href="/purchases/${PURCHASE_ID}"`);
  });

  it("схвалювач відділу бачить закупівлю свого відділу", async () => {
    signIn(viewer(P2, "approver"));
    setPurchaseDb({ visible: purchase(), approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain("Paper A4");
  });

  it("некоректний ідентифікатор — відмова без запиту до бази", async () => {
    const client = setPurchaseDb({ visible: purchase() });

    const html = renderToStaticMarkup(await PurchasePage(props("not-a-uuid")));

    expect(html).toContain("Not enough permissions");
    // Лише перевірка сесії й профілю (getViewer); жодного запиту заявки.
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("помилка читання відділу не видається за «—»", async () => {
    setPurchaseDb({ visible: purchase(), departmentError: { message: "connection reset" } });

    await expect(PurchasePage(props(PURCHASE_ID))).rejects.toThrow("Failed to read department");
  });

  it("гість — сторінка входу", async () => {
    signIn(null);

    await expect(PurchasePage(props(PURCHASE_ID))).rejects.toThrow("REDIRECT /login");
  });

  it("AC-APR-08: схвалювач відділу бачить на сторінці заявки автора «Andrii Demo-First»", async () => {
    signIn(viewer(P2, "approver"));
    const client = setPurchaseDb({ visible: purchase(), approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toMatch(/>Author<\/dt><dd data-testid="purchase-author">Andrii Demo-First<\/dd>/);
    expect(client.rpc).toHaveBeenCalledWith("purchase_author_names", { p_purchase_ids: [PURCHASE_ID] });
  });

  it("AC-APR-09: автор без імені — на сторінці заявки його email", async () => {
    signIn(viewer(P2, "approver"));
    setPurchaseDb({ visible: purchase(), approves: [PRIMARY.id], authorName: "petro@example.test" });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain('data-testid="purchase-author">petro@example.test<');
  });

  it("AC-APR-10: сторінка заявки не читає профіль автора — ролі, відділів і дозволів автора немає", async () => {
    signIn(viewer(P2, "approver"));
    const client = setPurchaseDb({ visible: purchase(), approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(client.from).not.toHaveBeenCalledWith("profiles");
    expect(client.from).not.toHaveBeenCalledWith("purchase_permissions");
    expect(html).not.toContain("data-role");
  });

  it("автор на сторінці своєї заявки бачить посилання назад «My requests»", async () => {
    setPurchaseDb({ visible: purchase() });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain('href="/purchases">← My requests</a>');
    expect(html).not.toContain("← Approvals");
  });

  it("схвалювач, який відкрив чужу заявку свого відділу, бачить посилання назад «Approvals»", async () => {
    signIn(viewer(P2, "approver"));
    setPurchaseDb({ visible: purchase(), approves: [PRIMARY.id] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain('href="/approvals">← Approvals</a>');
    expect(html).not.toContain("← My requests");
  });

  it("поки міграції з purchase_author_names немає в базі (PGRST202), сторінка заявки відкривається з «Author: —»", async () => {
    signIn(viewer(P2, "approver"));
    setPurchaseDb({
      visible: purchase(),
      approves: [PRIMARY.id],
      authorError: { code: "PGRST202", message: "Could not find the function public.purchase_author_names" },
    });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain('data-testid="purchase-author">—<');
    expect(html).toContain("Primary School");
  });

  it("інша помилка бази під час читання автора не ховається", async () => {
    signIn(viewer(P2, "approver"));
    setPurchaseDb({
      visible: purchase(),
      approves: [PRIMARY.id],
      authorError: { code: "57014", message: "canceling statement due to statement timeout" },
    });

    await expect(PurchasePage(props(PURCHASE_ID))).rejects.toThrow("Failed to read request authors");
  });
});

describe("історія на сторінці заявки", () => {
  const SUBMITTED = { kind: "submitted", created_at: "2026-11-05T19:32:00Z", actor_name: "PM Demo Requester" };

  beforeEach(() => {
    vi.clearAllMocks();
    signIn(viewer(P1));
  });

  it("AC-HIST-06: працівник 1 подав закупівлю у «Primary School» і відкриває її історію — запис «Submitted» з його іменем, датою й часом за America/New_York", async () => {
    const client = setPurchaseDb({ visible: purchase(), history: [SUBMITTED] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain("History");
    expect(html).toContain('data-testid="history-entry">Submitted · PM Demo Requester · 05.11.2026, 14:32<');
    expect(client.rpc).toHaveBeenCalledWith("purchase_history", { p_purchase_id: PURCHASE_ID });
  });

  it("AC-HIST-06: кілька записів — у порядку, який віддала база", async () => {
    const later = { ...SUBMITTED, created_at: "2026-11-06T13:05:00Z" };
    setPurchaseDb({ visible: purchase(), history: [SUBMITTED, later] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect([...html.matchAll(/data-testid="history-entry">([^<]*)</g)].map((m) => m[1])).toEqual([
      "Submitted · PM Demo Requester · 05.11.2026, 14:32",
      "Submitted · PM Demo Requester · 06.11.2026, 08:05",
    ]);
  });

  it("AC-HIST-10: Петро схвалює лише «Office» і відкриває заявку «Primary School» за прямим посиланням — «Not enough permissions», історії немає", async () => {
    signIn(viewer(P2, "approver"));
    const client = setPurchaseDb({ visible: null, approves: ["00000000-0000-4000-8000-0000000000d2"] });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain("Not enough permissions");
    expect(html).not.toContain("History");
    expect(html).not.toContain("Submitted");
    expect(html).not.toContain("Paper A4");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("AC-HIST-06: поки функції історії в базі немає (PGRST202) — блок «History» з «—», а не помилка", async () => {
    setPurchaseDb({
      visible: purchase(),
      historyError: { code: "PGRST202", message: "Could not find the function public.purchase_history" },
    });

    const html = renderToStaticMarkup(await PurchasePage(props(PURCHASE_ID)));

    expect(html).toContain("History");
    expect([...html.matchAll(/data-testid="history-empty">([^<]*)</g)].map((m) => m[1])).toEqual(["—"]);
    expect(html).not.toContain('data-testid="history-entry"');
    expect(html).toContain("Paper A4");
  });

  it("AC-HIST-06: інша помилка бази при читанні історії не ховається", async () => {
    setPurchaseDb({ visible: purchase(), historyError: { code: "57014", message: "statement timeout" } });

    await expect(PurchasePage(props(PURCHASE_ID))).rejects.toThrow("Failed to read request history: statement timeout");
  });
});
