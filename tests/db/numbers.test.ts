import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Наскрізний номер заявки (AC-HIST-01) на справжньому Postgres (PGlite): лічильник private.purchase_counter,
// який видає лише private.submit_purchase, і заповнення номерів наявних заявок міграцією purchase_number.

const NUMBER_MIGRATION = "20261106234630";
const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const LINE = JSON.stringify([{ name: "Paper A4", purpose: "Printing", quantity: "3", unit_price: "20.00" }]);

const submit = (t: PurchasingDb, userId: string, lines = LINE) =>
  t.asUser<{ id: string }>(userId, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb) as id", [
    PRIMARY,
    lines,
  ]);

const numberOf = async (t: PurchasingDb, id: string) =>
  (await t.asService<{ number: number }>("select number from public.purchases where id = $1", [id]))[0].number;

async function withPrimary(t: PurchasingDb, member: string) {
  await t.asService("insert into public.departments (id, name) values ($1, 'Primary School')", [PRIMARY]);
  await t.asService("insert into public.department_members (profile_id, department_id) values ($1, $2)", [
    member,
    PRIMARY,
  ]);
}

describe("номер заявки в базі — порожня система", () => {
  let t: PurchasingDb;
  let member1: string;

  beforeAll(async () => {
    t = await createPurchasingDb();
    member1 = t.users["member1@example.test"];
    await withPrimary(t, member1);
  }, 60_000);

  it("AC-HIST-01: у системі ще немає жодної закупівлі — перша й друга подані закупівлі мають номери 1 і 2 (PUR-1, PUR-2)", async () => {
    const [{ id: first }] = await submit(t, member1);
    const [{ id: second }] = await submit(t, member1);

    expect(await numberOf(t, first)).toBe(1);
    expect(await numberOf(t, second)).toBe(2);
  });

  it("AC-HIST-01: невдале подання (рядок без полів — LINE_FIELDS) не лишає пропуску — наступне отримує наступний номер", async () => {
    const [{ n: before }] = await t.asService<{ n: number }>("select max(number) as n from public.purchases");

    await expect(submit(t, member1, JSON.stringify([{ name: "Paper A4" }]))).rejects.toThrow(/LINE_FIELDS/);
    const [{ id }] = await submit(t, member1);

    expect(await numberOf(t, id)).toBe(before + 1);
  });

  it("AC-HIST-01: номер не повторюється після видалення заявки — лічильник не відкочується", async () => {
    const [{ id }] = await submit(t, member1);
    const deleted = await numberOf(t, id);
    await t.asService("delete from public.purchases where id = $1", [id]);

    const [{ id: next }] = await submit(t, member1);
    expect(await numberOf(t, next)).toBe(deleted + 1);
  });

  it("AC-HIST-01: лічильник недоступний працівникам і гостям — немає прав, прямий update — permission denied", async () => {
    // Від імені власника: service_role не має usage на схему private, тож саме ім'я таблиці йому не розв'язується.
    const [privileges] = (
      await t.db.query<Record<string, boolean>>(
        `select
         has_table_privilege('authenticated', 'private.purchase_counter', 'select') as auth_select,
         has_table_privilege('authenticated', 'private.purchase_counter', 'update') as auth_update,
         has_table_privilege('anon', 'private.purchase_counter', 'select') as anon_select,
         has_table_privilege('anon', 'private.purchase_counter', 'update') as anon_update,
         has_function_privilege('authenticated', 'private.insert_purchase_lines(uuid, jsonb)', 'execute') as lines_exec`,
      )
    ).rows;
    expect(privileges).toEqual({
      auth_select: false,
      auth_update: false,
      anon_select: false,
      anon_update: false,
      lines_exec: false,
    });

    const [{ last_number: before }] = (
      await t.db.query<{ last_number: number }>("select last_number from private.purchase_counter")
    ).rows;
    await expect(t.asUser(member1, "update private.purchase_counter set last_number = 0")).rejects.toThrow(
      /permission denied/,
    );
    const [{ last_number: after }] = (
      await t.db.query<{ last_number: number }>("select last_number from private.purchase_counter")
    ).rows;
    expect(after).toBe(before);
  });
});

describe("номер заявки в базі — наявні заявки до міграції", () => {
  let t: PurchasingDb;
  let member1: string;
  const ids = {
    newest: "00000000-0000-4000-8000-0000000000a3",
    middleB: "00000000-0000-4000-8000-0000000000a2",
    middleA: "00000000-0000-4000-8000-0000000000a1",
  };

  beforeAll(async () => {
    t = await createPurchasingDb({ stopBefore: NUMBER_MIGRATION });
    member1 = t.users["member1@example.test"];
    await withPrimary(t, member1);
    // Дві заявки з однаковим created_at: порядок розводить id (a1 раніше за a2).
    await t.asService(
      `insert into public.purchases (id, author_id, department_id, purchase_type, created_at) values
         ($1, $4, $5, 'purchasing_department', '2026-10-27 09:00:00+00'),
         ($2, $4, $5, 'purchasing_department', '2026-10-26 09:00:00+00'),
         ($3, $4, $5, 'purchasing_department', '2026-10-26 09:00:00+00')`,
      [ids.newest, ids.middleB, ids.middleA, member1, PRIMARY],
    );
    await t.applyRemainingMigrations();
  }, 60_000);

  it("AC-HIST-01: наявним заявкам номери видано за датою подання (рівні дати — за id), перше нове подання — N + 1", async () => {
    expect(await numberOf(t, ids.middleA)).toBe(1);
    expect(await numberOf(t, ids.middleB)).toBe(2);
    expect(await numberOf(t, ids.newest)).toBe(3);

    const [{ id }] = await submit(t, member1);
    expect(await numberOf(t, id)).toBe(4);
  });
});
