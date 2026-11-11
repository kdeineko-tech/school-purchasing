import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Повернення на доопрацювання й повторне подання на справжньому Postgres (PGlite): purchases.return_reason,
// decide_purchase з 'return' і resubmit_purchase із supabase/migrations/20261111155530_return_for_revision.sql. Кожна
// відмова перевіряє і відмову, і що ні заявка, ні рядки, ні історія не змінилися.

const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const OFFICE = "00000000-0000-4000-8000-0000000000d2";
const line = (name: string, quantity = "2") => ({ name, purpose: "Classes", quantity, unit_price: "5.00" });
const TWO_LINES = JSON.stringify([line("Paper A4"), line("Pens")]);
// Автор виправив рядок 1 (кількість 2 → 5), рядок 2 той самий.
const FIXED_LINES = JSON.stringify([line("Paper A4", "5"), line("Pens")]);

type State = {
  status: string;
  return_reason: string | null;
  rejection_reason: string | null;
  decided_by: string | null;
  decided_at: string | null;
  department_id: string;
  purchase_type: string;
  number: number;
  lines: { name: string; quantity: number; status: string }[];
  events: string[];
};

const submit = async (t: PurchasingDb, author: string, department: string, type = "purchasing_department") =>
  (
    await t.asUser<{ id: string }>(author, "select public.submit_purchase($1, $2, $3::jsonb) as id", [
      department,
      type,
      TWO_LINES,
    ])
  )[0].id;

const decide = (t: PurchasingDb, who: string, id: string, decision: string, reason: string | null, rejected: unknown = null) =>
  t.asUser(who, "select public.decide_purchase($1, $2, $3, $4::uuid[])", [id, decision, reason, rejected]);

const resubmit = (t: PurchasingDb, who: string, id: string, lines = FIXED_LINES) =>
  t.asUser(who, "select public.resubmit_purchase($1, $2::jsonb)", [id, lines]);

const stateOf = async (t: PurchasingDb, id: string): Promise<State> => {
  const [purchase] = await t.asService<Omit<State, "lines" | "events">>(
    `select status, return_reason, rejection_reason, decided_by, decided_at::text, department_id, purchase_type, number
     from public.purchases where id = $1`,
    [id],
  );
  const lines = await t.asService<State["lines"][number]>(
    "select name, quantity, status from public.purchase_lines where purchase_id = $1 order by position",
    [id],
  );
  const events = await t.asService<{ kind: string }>(
    "select kind from public.purchase_events where purchase_id = $1 order by created_at, id",
    [id],
  );
  return { ...purchase, lines, events: events.map((e) => e.kind) };
};

describe("повернення на доопрацювання в базі", () => {
  let t: PurchasingDb;
  let admin: string; // адміністратор
  let member1: string; // працівник 1 — заявник «Primary School»
  let member2: string; // Марія — схвалювач «Primary School»
  let member3: string; // заявник «Office», не член «Primary School»

  beforeAll(async () => {
    t = await createPurchasingDb();
    admin = t.users["admin@example.test"];
    member1 = t.users["member1@example.test"];
    member2 = t.users["member2@example.test"];
    member3 = t.users["pm-requester@example.test"];
    await t.asService("insert into public.departments (id, name) values ($1, 'Primary School'), ($2, 'Office')", [
      PRIMARY,
      OFFICE,
    ]);
    await t.asService(
      `insert into public.department_members (profile_id, department_id, approves)
       values ($1, $4, false), ($2, $4, true), ($3, $5, false)`,
      [member1, member2, member3, PRIMARY, OFFICE],
    );
  }, 60_000);

  // Заявка автора author, яку Марія повернула з причиною «Уточніть кількість».
  const returned = async (author: string, department = PRIMARY) => {
    const id = await submit(t, author, department);
    await decide(t, member2, id, "return", "Уточніть кількість");
    return id;
  };

  it("AC-DEC-04: Марія повертає заявку з причиною «Уточніть кількість» — статус «Повернено на доопрацювання»", async () => {
    const id = await submit(t, member1, PRIMARY);

    await decide(t, member2, id, "return", "  Уточніть кількість ");

    expect(await stateOf(t, id)).toMatchObject({
      status: "returned",
      return_reason: "Уточніть кількість",
      rejection_reason: null,
      decided_by: member2,
      // Рядки не вирішено — лишаються «pending».
      lines: [
        { name: "Paper A4", quantity: 2, status: "pending" },
        { name: "Pens", quantity: 2, status: "pending" },
      ],
    });
    // Автор бачить причину під RLS.
    const [seen] = await t.asUser<{ status: string; return_reason: string }>(
      member1,
      "select status, return_reason from public.purchases where id = $1",
      [id],
    );
    expect(seen).toEqual({ status: "returned", return_reason: "Уточніть кількість" });
  });

  it("AC-DEC-06: Марія повертає заявку без причини — REASON_REQUIRED, статус лишається «Очікує схвалення»", async () => {
    const id = await submit(t, member1, PRIMARY);
    const before = await stateOf(t, id);

    for (const reason of [null, "", "   "]) {
      await expect(decide(t, member2, id, "return", reason)).rejects.toThrow(/REASON_REQUIRED/);
    }

    expect(await stateOf(t, id)).toEqual(before);
    expect(before.status).toBe("awaiting_approval");
  });

  it("AC-DEC-04: повернення з позначеними рядками — FORBIDDEN, без змін", async () => {
    const id = await submit(t, member1, PRIMARY);
    const before = await stateOf(t, id);
    const [{ id: first }] = await t.asService<{ id: string }>(
      "select id from public.purchase_lines where purchase_id = $1 order by position limit 1",
      [id],
    );

    await expect(decide(t, member2, id, "return", "Уточніть кількість", [first])).rejects.toThrow(/FORBIDDEN/);

    expect(await stateOf(t, id)).toEqual(before);
  });

  it("AC-DEC-04: повернути може лише схвалювач відділу, не автор і не непризначений адміністратор — FORBIDDEN, без змін", async () => {
    const id = await submit(t, member1, PRIMARY);
    const before = await stateOf(t, id);

    for (const who of [member1, member3, admin]) {
      await expect(decide(t, who, id, "return", "Уточніть кількість")).rejects.toThrow(/FORBIDDEN/);
    }

    expect(await stateOf(t, id)).toEqual(before);
  });

  it("AC-DEC-07: автор виправив рядок 1 і подає знову — «Очікує схвалення», відділ, тип і номер ті самі", async () => {
    const id = await returned(member1);
    const before = await stateOf(t, id);

    await resubmit(t, member1, id);

    expect(await stateOf(t, id)).toEqual({
      status: "awaiting_approval",
      return_reason: null,
      rejection_reason: null,
      decided_by: null,
      decided_at: null,
      department_id: PRIMARY,
      purchase_type: before.purchase_type,
      number: before.number,
      lines: [
        { name: "Paper A4", quantity: 5, status: "pending" },
        { name: "Pens", quantity: 2, status: "pending" },
      ],
      // Ще один запис «Подано» (AC-HIST-06).
      events: ["submitted", "submitted"],
    });
    // Подану знову заявку Марія вирішує, як звичайну.
    await decide(t, member2, id, "approve", null);
    expect((await stateOf(t, id)).status).toBe("approved");
  });

  it("AC-DEC-07: подати знову з рядком без поля — LINE_FIELDS, заявка й рядки без змін", async () => {
    const id = await returned(member1);
    const before = await stateOf(t, id);

    await expect(resubmit(t, member1, id, JSON.stringify([{ ...line("Paper A4"), purpose: " " }]))).rejects.toThrow(
      /LINE_FIELDS/,
    );
    await expect(resubmit(t, member1, id, "[]")).rejects.toThrow(/NO_LINES/);

    expect(await stateOf(t, id)).toEqual(before);
  });

  it("AC-DEC-07: подати знову може лише автор — Марія чи адміністратор отримують FORBIDDEN, без змін", async () => {
    const id = await returned(member1);
    const before = await stateOf(t, id);

    for (const who of [member2, admin]) {
      await expect(resubmit(t, who, id)).rejects.toThrow(/FORBIDDEN/);
    }

    expect(await stateOf(t, id)).toEqual(before);
  });

  it("AC-DEC-07: подати знову можна лише повернену заявку — очікує, схвалена й відхилена — FORBIDDEN, без змін", async () => {
    const awaiting = await submit(t, member1, PRIMARY);
    const approved = await submit(t, member1, PRIMARY);
    await decide(t, member2, approved, "approve", null);
    const rejected = await submit(t, member1, PRIMARY);
    await decide(t, member2, rejected, "reject", "Немає бюджету");

    for (const id of [awaiting, approved, rejected]) {
      const before = await stateOf(t, id);
      await expect(resubmit(t, member1, id)).rejects.toThrow(/FORBIDDEN/);
      expect(await stateOf(t, id)).toEqual(before);
    }
    // Заявки, якої немає, — та сама відмова.
    await expect(resubmit(t, member1, "00000000-0000-4000-8000-0000000000ff")).rejects.toThrow(/FORBIDDEN/);
  });

  it("AC-DEC-07: деактивований автор не подає знову — FORBIDDEN, без змін", async () => {
    const id = await returned(member1);
    const before = await stateOf(t, id);
    await t.asService("update public.profiles set is_active = false where id = $1", [member1]);
    try {
      await expect(resubmit(t, member1, id)).rejects.toThrow(/FORBIDDEN/);
    } finally {
      await t.asService("update public.profiles set is_active = true where id = $1", [member1]);
    }

    expect(await stateOf(t, id)).toEqual(before);
  });

  it("AC-DEC-07: автор не admin, якого вже прибрали з відділу заявки, — FORBIDDEN, без змін", async () => {
    const id = await returned(member1);
    const before = await stateOf(t, id);
    await t.asService("delete from public.department_members where profile_id = $1 and department_id = $2", [
      member1,
      PRIMARY,
    ]);
    try {
      await expect(resubmit(t, member1, id)).rejects.toThrow(/FORBIDDEN/);
    } finally {
      await t.asService(
        "insert into public.department_members (profile_id, department_id, approves) values ($1, $2, false)",
        [member1, PRIMARY],
      );
    }

    expect(await stateOf(t, id)).toEqual(before);
  });

  it("AC-DEC-07: активний автор admin без членства у відділі заявки подає знову, як і вперше", async () => {
    const id = await returned(admin);

    await resubmit(t, admin, id);

    expect(await stateOf(t, id)).toMatchObject({ status: "awaiting_approval", department_id: PRIMARY });
  });

  it("працівник не змінює заявку напряму в обхід функцій — permission denied", async () => {
    const id = await returned(member1);
    const before = await stateOf(t, id);

    await expect(
      t.asUser(member1, "update public.purchases set status = 'awaiting_approval' where id = $1", [id]),
    ).rejects.toThrow(/permission denied/);
    await expect(t.asUser(member1, "delete from public.purchase_lines where purchase_id = $1", [id])).rejects.toThrow(
      /permission denied/,
    );

    expect(await stateOf(t, id)).toEqual(before);
  });

  it("повернена заявка без причини неможлива й для service_role — check purchases_return_reason_check", async () => {
    const id = await submit(t, member1, PRIMARY);

    await expect(
      t.asService("update public.purchases set status = 'returned', return_reason = ' ' where id = $1", [id]),
    ).rejects.toThrow(/purchases_return_reason_check/);
  });
});
