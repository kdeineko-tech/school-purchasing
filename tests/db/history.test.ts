import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Історія заявки на справжньому Postgres (PGlite): таблиця purchase_events, запис «Подано» з private.submit_purchase і
// функція public.purchase_history із supabase/migrations/20261109144820_purchase_history.sql (ADR 0005). Відмовні
// тести AC-HIST-10 — і прямий select з purchase_events (політика RLS), і функція (її власна перевірка видимості).

const HISTORY_MIGRATION = "20261109144820";
const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const OFFICE = "00000000-0000-4000-8000-0000000000d2";
const LINE = JSON.stringify([{ name: "Paper A4", purpose: "Printing", quantity: "3", unit_price: "20.00" }]);

type HistoryRow = { kind: string; created_at: Date; actor_name: string };

const submit = async (t: PurchasingDb, author: string, department: string, lines = LINE) =>
  (
    await t.asUser<{ id: string }>(author, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb) as id", [
      department,
      lines,
    ])
  )[0].id;

const history = (t: PurchasingDb, who: string, id: string) =>
  t.asUser<HistoryRow>(who, "select * from public.purchase_history($1)", [id]);

const directEvents = (t: PurchasingDb, who: string, id: string) =>
  t.asUser<{ kind: string }>(who, "select kind from public.purchase_events where purchase_id = $1", [id]);

const purchaseRow = async (t: PurchasingDb, id: string) =>
  (
    await t.asService<{ status: string; author_id: string; created_at: Date }>(
      "select status, author_id, created_at from public.purchases where id = $1",
      [id],
    )
  )[0];

const eventCount = async (t: PurchasingDb) =>
  Number((await t.asService<{ n: string }>("select count(*) as n from public.purchase_events"))[0].n);

describe("історія заявки в базі", () => {
  let t: PurchasingDb;
  let member1: string; // працівник 1 — заявник «Primary School»
  let member2: string; // Марія — схвалювач «Primary School»
  let pmRequester: string; // заявник «Office»
  let petro: string; // Петро — схвалює лише «Office»; у «Primary School» — лише заявник

  beforeAll(async () => {
    t = await createPurchasingDb();
    member1 = t.users["member1@example.test"];
    member2 = t.users["member2@example.test"];
    pmRequester = t.users["pm-requester@example.test"];
    petro = t.users["pm-approver@example.test"];
    await t.asService("insert into public.departments (id, name) values ($1, 'Primary School'), ($2, 'Office')", [
      PRIMARY,
      OFFICE,
    ]);
    await t.asService(
      `insert into public.department_members (profile_id, department_id, approves)
       values ($1, $5, false), ($2, $5, true), ($3, $6, false), ($4, $6, true), ($4, $5, false)`,
      [member1, member2, pmRequester, petro, PRIMARY, OFFICE],
    );
    await t.asService("update public.profiles set full_name = 'Працівник 1' where id = $1", [member1]);
    await t.asService("update public.profiles set full_name = 'Петро' where id = $1", [petro]);
    await t.asService("update public.profiles set full_name = null where id = $1", [pmRequester]);
  }, 60_000);

  it("AC-HIST-06: працівник 1 подав закупівлю у «Primary School» — в історії запис «Подано» з його іменем і часом подання", async () => {
    const id = await submit(t, member1, PRIMARY);
    const purchase = await purchaseRow(t, id);

    const rows = await history(t, member1, id);

    expect(rows).toEqual([{ kind: "submitted", created_at: purchase.created_at, actor_name: "Працівник 1" }]);
  });

  it("AC-HIST-06: схвалювач відділу бачить той самий запис; автор без імені — email", async () => {
    const id = await submit(t, pmRequester, OFFICE);

    expect((await history(t, petro, id)).map((r) => [r.kind, r.actor_name])).toEqual([
      ["submitted", "pm-requester@example.test"],
    ]);
  });

  it("AC-HIST-06: невдале подання (рядок без полів — LINE_FIELDS) не лишає запису історії", async () => {
    const before = await eventCount(t);

    await expect(submit(t, member1, PRIMARY, JSON.stringify([{ name: "Paper A4" }]))).rejects.toThrow(/LINE_FIELDS/);

    expect(await eventCount(t)).toBe(before);
  });

  it("AC-HIST-06: функція повертає лише вид, час і ім'я — без id, email чи ролі того, хто діяв", async () => {
    const id = await submit(t, member1, PRIMARY);

    const [row] = await history(t, member1, id);

    expect(Object.keys(row).sort()).toEqual(["actor_name", "created_at", "kind"]);
  });

  it("AC-HIST-10: Петро схвалює лише «Office» — історію заявки «Office» бачить, а заявки «Primary School» ні прямим select, ні функцією; статус той самий", async () => {
    const office = await submit(t, pmRequester, OFFICE);
    const primary = await submit(t, member1, PRIMARY);

    // Контроль: Петро не «сліпий» — історію свого відділу бачить обома шляхами.
    expect(await history(t, petro, office)).toHaveLength(1);
    expect(await directEvents(t, petro, office)).toEqual([{ kind: "submitted" }]);

    expect(await directEvents(t, petro, primary)).toEqual([]);
    expect(await history(t, petro, primary)).toEqual([]);
    expect((await purchaseRow(t, primary)).status).toBe("awaiting_approval");
    // Записи є — їх просто не видно Петрові.
    expect(await directEvents(t, member1, primary)).toEqual([{ kind: "submitted" }]);
  });

  it("AC-HIST-10: Петро — автор заявки «Primary School», де він не схвалює, — бачить власну історію", async () => {
    const id = await submit(t, petro, PRIMARY);

    expect((await history(t, petro, id)).map((r) => r.actor_name)).toEqual(["Петро"]);
    expect(await directEvents(t, petro, id)).toEqual([{ kind: "submitted" }]);
  });

  it("AC-HIST-10: деактивований автор не бачить власної історії — функція definer сама перевіряє активність", async () => {
    const id = await submit(t, member1, PRIMARY);
    expect(await history(t, member1, id)).toHaveLength(1);

    await t.asService("update public.profiles set is_active = false where id = $1", [member1]);
    try {
      expect(await history(t, member1, id)).toEqual([]);
      expect(await directEvents(t, member1, id)).toEqual([]);
    } finally {
      await t.asService("update public.profiles set is_active = true where id = $1", [member1]);
    }
  });

  it("AC-HIST-10: неіснуюча заявка — 0 рядків, без помилки", async () => {
    expect(await history(t, member1, "00000000-0000-4000-8000-0000000000ff")).toEqual([]);
  });

  it("AC-HIST-10: записи історії не змінює ніхто з працівників — немає прав, прямий insert / update / delete — permission denied", async () => {
    const id = await submit(t, member1, PRIMARY);
    const [privileges] = (
      await t.db.query<Record<string, boolean>>(
        `select
         has_table_privilege('authenticated', 'public.purchase_events', 'select') as auth_select,
         has_table_privilege('authenticated', 'public.purchase_events', 'insert') as auth_insert,
         has_table_privilege('authenticated', 'public.purchase_events', 'update') as auth_update,
         has_table_privilege('authenticated', 'public.purchase_events', 'delete') as auth_delete,
         has_table_privilege('anon', 'public.purchase_events', 'select') as anon_select,
         has_function_privilege('anon', 'public.purchase_history(uuid)', 'execute') as anon_history`,
      )
    ).rows;
    expect(privileges).toEqual({
      auth_select: true,
      auth_insert: false,
      auth_update: false,
      auth_delete: false,
      anon_select: false,
      anon_history: false,
    });

    const before = await eventCount(t);
    await expect(
      t.asUser(member1, "insert into public.purchase_events (purchase_id, kind, actor_id) values ($1, 'submitted', $2)", [
        id,
        member1,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.asUser(member1, "update public.purchase_events set created_at = now() - interval '1 day' where purchase_id = $1", [
        id,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(t.asUser(member1, "delete from public.purchase_events where purchase_id = $1", [id])).rejects.toThrow(
      /permission denied/,
    );
    expect(await eventCount(t)).toBe(before);
  });
});

describe("історія заявки в базі — наявні заявки до міграції", () => {
  let t: PurchasingDb;
  let member1: string;
  const OLD = "00000000-0000-4000-8000-0000000000a1";

  beforeAll(async () => {
    t = await createPurchasingDb({ stopBefore: HISTORY_MIGRATION });
    member1 = t.users["member1@example.test"];
    await t.asService("insert into public.departments (id, name) values ($1, 'Primary School')", [PRIMARY]);
    await t.asService("insert into public.department_members (profile_id, department_id) values ($1, $2)", [
      member1,
      PRIMARY,
    ]);
    await t.asService(
      `insert into public.purchases (id, author_id, department_id, purchase_type, number, created_at)
       values ($1, $2, $3, 'purchasing_department', 1, '2026-10-26 09:00:00+00')`,
      [OLD, member1, PRIMARY],
    );
    await t.applyRemainingMigrations();
  }, 60_000);

  it("AC-HIST-06: наявна заявка отримує запис «Подано» з автором і датою подання заявки", async () => {
    const rows = await t.asService<{ kind: string; actor_id: string; created_at: Date }>(
      "select kind, actor_id, created_at from public.purchase_events where purchase_id = $1",
      [OLD],
    );

    expect(rows).toEqual([{ kind: "submitted", actor_id: member1, created_at: new Date("2026-10-26T09:00:00Z") }]);
  });
});
