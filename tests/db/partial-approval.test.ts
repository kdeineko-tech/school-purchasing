import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Часткове схвалення на справжньому Postgres (PGlite): purchase_lines.status і нова private.decide_purchase з
// p_rejected_lines із supabase/migrations/20261109171140_partial_approval.sql. Кожна відмова перевіряє і відмову, і
// що ні заявка, ні рядки не змінилися.

const PARTIAL_MIGRATION = "20261109171140";
const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const OFFICE = "00000000-0000-4000-8000-0000000000d2";
const line = (name: string) => ({ name, purpose: "Classes", quantity: "2", unit_price: "5.00" });
const THREE_LINES = JSON.stringify([line("Paper A4"), line("Pens"), line("Markers")]);

type State = { status: string; rejection_reason: string | null; decided_by: string | null; lines: string[] };

const submit = async (t: PurchasingDb, author: string, department: string, lines = THREE_LINES) =>
  (
    await t.asUser<{ id: string }>(author, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb) as id", [
      department,
      lines,
    ])
  )[0].id;

const lineIds = async (t: PurchasingDb, purchaseId: string) =>
  (
    await t.asService<{ id: string }>("select id from public.purchase_lines where purchase_id = $1 order by position", [
      purchaseId,
    ])
  ).map((r) => r.id);

const decide = (t: PurchasingDb, who: string, id: string, decision: string, reason: string | null, rejected: unknown) =>
  t.asUser(who, "select public.decide_purchase($1, $2, $3, $4::uuid[])", [id, decision, reason, rejected]);

const stateOf = async (t: PurchasingDb, id: string): Promise<State> => {
  const [purchase] = await t.asService<Omit<State, "lines">>(
    "select status, rejection_reason, decided_by from public.purchases where id = $1",
    [id],
  );
  const lines = await t.asService<{ status: string }>(
    "select status from public.purchase_lines where purchase_id = $1 order by position",
    [id],
  );
  return { ...purchase, lines: lines.map((l) => l.status) };
};

const PENDING: State = {
  status: "awaiting_approval",
  rejection_reason: null,
  decided_by: null,
  lines: ["pending", "pending", "pending"],
};

describe("часткове схвалення в базі", () => {
  let t: PurchasingDb;
  let admin: string; // адміністратор, не схвалювач «Primary School»
  let member1: string; // працівник 1 — заявник «Primary School»
  let member2: string; // Марія — схвалювач «Primary School»

  beforeAll(async () => {
    t = await createPurchasingDb();
    admin = t.users["admin@example.test"];
    member1 = t.users["member1@example.test"];
    member2 = t.users["member2@example.test"];
    await t.asService("insert into public.departments (id, name) values ($1, 'Primary School'), ($2, 'Office')", [
      PRIMARY,
      OFFICE,
    ]);
    await t.asService(
      `insert into public.department_members (profile_id, department_id, approves)
       values ($1, $3, false), ($2, $3, true)`,
      [member1, member2, PRIMARY],
    );
  }, 60_000);

  it("AC-DEC-01: Марія відхиляє рядок 2 і схвалює заявку — «Частково схвалено», автор бачить рядок 2 «Відхилено», рядки 1 і 3 «Схвалено»", async () => {
    const id = await submit(t, member1, PRIMARY);
    const [, second] = await lineIds(t, id);
    expect(await stateOf(t, id)).toEqual(PENDING);

    await decide(t, member2, id, "approve", null, [second]);

    expect(await stateOf(t, id)).toMatchObject({ status: "partially_approved", rejection_reason: null, decided_by: member2 });
    // Автор бачить статуси рядків під RLS.
    const seen = await t.asUser<{ name: string; status: string }>(
      member1,
      "select name, status from public.purchase_lines where purchase_id = $1 order by position",
      [id],
    );
    expect(seen).toEqual([
      { name: "Paper A4", status: "approved" },
      { name: "Pens", status: "rejected" },
      { name: "Markers", status: "approved" },
    ]);
  });

  it("AC-DEC-01: схвалення без позначених рядків — заявка й усі рядки «Схвалено»", async () => {
    const id = await submit(t, member1, PRIMARY);

    await decide(t, member2, id, "approve", null, []);

    expect(await stateOf(t, id)).toEqual({
      status: "approved",
      rejection_reason: null,
      decided_by: member2,
      lines: ["approved", "approved", "approved"],
    });
  });

  it("AC-DEC-01: відхилення заявки з причиною — усі рядки «Відхилено»", async () => {
    const id = await submit(t, member1, PRIMARY);

    await decide(t, member2, id, "reject", "Немає бюджету", null);

    expect(await stateOf(t, id)).toEqual({
      status: "rejected",
      rejection_reason: "Немає бюджету",
      decided_by: member2,
      lines: ["rejected", "rejected", "rejected"],
    });
  });

  it("AC-DEC-01: старий виклик із трьома аргументами (застосунок зрізу 2) схвалює, а у pg_proc одна public.decide_purchase", async () => {
    const id = await submit(t, member1, PRIMARY);

    await t.asUser(member2, "select public.decide_purchase($1, 'approve', null)", [id]);

    expect(await stateOf(t, id)).toMatchObject({ status: "approved", lines: ["approved", "approved", "approved"] });
    const [{ n }] = (
      await t.db.query<{ n: number }>(
        `select count(*)::int as n from pg_proc as p join pg_namespace as s on s.oid = p.pronamespace
         where s.nspname = 'public' and p.proname = 'decide_purchase'`,
      )
    ).rows;
    expect(n).toBe(1);
  });

  it("усі рядки відхилено й «Approve» — ALL_LINES_REJECTED, без змін", async () => {
    const id = await submit(t, member1, PRIMARY);

    await expect(decide(t, member2, id, "approve", null, await lineIds(t, id))).rejects.toThrow(/ALL_LINES_REJECTED/);

    expect(await stateOf(t, id)).toEqual(PENDING);
  });

  it("рядок іншої заявки чи null серед позначених — FORBIDDEN, без змін", async () => {
    const id = await submit(t, member1, PRIMARY);
    const other = await submit(t, member1, PRIMARY);
    const [otherLine] = await lineIds(t, other);
    const [first] = await lineIds(t, id);

    await expect(decide(t, member2, id, "approve", null, [otherLine])).rejects.toThrow(/FORBIDDEN/);
    await expect(decide(t, member2, id, "approve", null, [first, null])).rejects.toThrow(/FORBIDDEN/);

    expect(await stateOf(t, id)).toEqual(PENDING);
    expect(await stateOf(t, other)).toEqual(PENDING);
  });

  it("відхилення заявки з позначеними рядками — FORBIDDEN, без змін", async () => {
    const id = await submit(t, member1, PRIMARY);
    const [first] = await lineIds(t, id);

    await expect(decide(t, member2, id, "reject", "Немає бюджету", [first])).rejects.toThrow(/FORBIDDEN/);

    expect(await stateOf(t, id)).toEqual(PENDING);
  });

  it("непризначений адміністратор (не схвалювач «Primary School») — FORBIDDEN, без змін (#62)", async () => {
    const id = await submit(t, member1, PRIMARY);
    const [first] = await lineIds(t, id);

    await expect(decide(t, admin, id, "approve", null, [first])).rejects.toThrow(/FORBIDDEN/);

    expect(await stateOf(t, id)).toEqual(PENDING);
  });

  it("працівник не змінює статус рядка напряму в обхід функції — permission denied", async () => {
    const id = await submit(t, member1, PRIMARY);

    await expect(
      t.asUser(member2, "update public.purchase_lines set status = 'approved' where purchase_id = $1", [id]),
    ).rejects.toThrow(/permission denied/);

    expect(await stateOf(t, id)).toEqual(PENDING);
  });
});

describe("часткове схвалення в базі — наявні заявки до міграції", () => {
  let t: PurchasingDb;
  const ids = {
    awaiting_approval: "00000000-0000-4000-8000-0000000000a1",
    approved: "00000000-0000-4000-8000-0000000000a2",
    rejected: "00000000-0000-4000-8000-0000000000a3",
  };

  beforeAll(async () => {
    t = await createPurchasingDb({ stopBefore: PARTIAL_MIGRATION });
    const member1 = t.users["member1@example.test"];
    await t.asService("insert into public.departments (id, name) values ($1, 'Primary School')", [PRIMARY]);
    let number = 0;
    for (const [status, id] of Object.entries(ids)) {
      number += 1;
      await t.asService(
        `insert into public.purchases (id, author_id, department_id, purchase_type, number, status, rejection_reason)
         values ($1, $2, $3, 'purchasing_department', $4, $5, case when $5 = 'rejected' then 'Немає бюджету' end)`,
        [id, member1, PRIMARY, number, status],
      );
      await t.asService(
        "insert into public.purchase_lines (purchase_id, position, name, purpose, quantity, unit_price) values ($1, 1, 'Paper A4', 'Printing', 3, 20)",
        [id],
      );
    }
    await t.applyRemainingMigrations();
  }, 60_000);

  it("AC-DEC-01: рядки наявних заявок отримують статус заявки; заявки, що чекають, — «pending»", async () => {
    expect((await stateOf(t, ids.awaiting_approval)).lines).toEqual(["pending"]);
    expect((await stateOf(t, ids.approved)).lines).toEqual(["approved"]);
    expect((await stateOf(t, ids.rejected)).lines).toEqual(["rejected"]);
  });
});
