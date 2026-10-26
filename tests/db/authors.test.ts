import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Ім'я автора заявки на справжньому Postgres (PGlite): функція public.purchase_author_names із
// supabase/migrations/20261026155141_purchase_author_names.sql. Відмовні тести перевіряють, що імені немає і що
// профіль автора лишається закритим (RLS profiles_select_own_or_admin).

const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const OFFICE = "00000000-0000-4000-8000-0000000000d2";
const LINE = JSON.stringify([{ name: "Paper A4", purpose: "Printing", quantity: "3", unit_price: "20.00" }]);

let t: PurchasingDb;
let admin: string;
let member1: string; // Петро — заявник «Primary School», автор заявок
let member2: string; // Марія — схвалювач «Primary School»
let pmRequester: string; // заявник «Primary School» без імені в профілі
let pmApprover: string; // схвалювач лише «Office»

const submit = async (author: string, department: string) =>
  (
    await t.asUser<{ id: string }>(author, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb) as id", [
      department,
      LINE,
    ])
  )[0].id;

const authorNames = (who: string, ids: string[]) =>
  t.asUser<{ purchase_id: string; author_name: string }>(who, "select * from public.purchase_author_names($1::uuid[])", [
    ids,
  ]);

beforeAll(async () => {
  t = await createPurchasingDb();
  admin = t.users["admin@example.test"];
  member1 = t.users["member1@example.test"];
  member2 = t.users["member2@example.test"];
  pmRequester = t.users["pm-requester@example.test"];
  pmApprover = t.users["pm-approver@example.test"];
  await t.asService("insert into public.departments (id, name) values ($1, 'Primary School'), ($2, 'Office')", [
    PRIMARY,
    OFFICE,
  ]);
  await t.asService(
    `insert into public.department_members (profile_id, department_id, approves)
     values ($1, $5, false), ($2, $5, true), ($3, $5, false), ($4, $6, true)`,
    [member1, member2, pmRequester, pmApprover, PRIMARY, OFFICE],
  );
  await t.asService("update public.profiles set full_name = 'Петро' where id = $1", [member1]);
  await t.asService("update public.profiles set full_name = null where id = $1", [pmRequester]);
}, 60_000);

describe("ім'я автора заявки в базі", () => {
  it("AC-APR-08: Марія, схвалювач «Primary School», отримує ім'я автора «Петро» для заявки свого відділу", async () => {
    const id = await submit(member1, PRIMARY);

    expect(await authorNames(member2, [id])).toEqual([{ purchase_id: id, author_name: "Петро" }]);
  });

  it("AC-APR-09: автор без імені в профілі — замість імені email", async () => {
    const id = await submit(pmRequester, PRIMARY);

    expect(await authorNames(member2, [id])).toEqual([{ purchase_id: id, author_name: "pm-requester@example.test" }]);
  });

  it("AC-APR-09: ім'я лише з пробілів — теж email", async () => {
    await t.asService("update public.profiles set full_name = '   ' where id = $1", [pmRequester]);
    const id = await submit(pmRequester, PRIMARY);

    expect((await authorNames(member2, [id]))[0].author_name).toBe("pm-requester@example.test");
    await t.asService("update public.profiles set full_name = null where id = $1", [pmRequester]);
  });

  it("AC-APR-10: функція повертає лише заявку й ім'я — ролі, відділів і дозволів автора немає", async () => {
    const id = await submit(member1, PRIMARY);

    const [row] = await authorNames(member2, [id]);

    expect(Object.keys(row).sort()).toEqual(["author_name", "purchase_id"]);
  });

  it("AC-APR-10: профіль автора для схвалювача й далі закритий — прямий select з profiles порожній", async () => {
    expect(await t.asUser(member2, "select role from public.profiles where id = $1", [member1])).toHaveLength(0);
  });

  it("автор бачить своє ім'я на власній заявці", async () => {
    const id = await submit(member1, PRIMARY);

    expect(await authorNames(member1, [id])).toEqual([{ purchase_id: id, author_name: "Петро" }]);
  });

  it("адміністратор бачить ім'я автора будь-якої заявки", async () => {
    const id = await submit(member1, PRIMARY);

    expect(await authorNames(admin, [id])).toEqual([{ purchase_id: id, author_name: "Петро" }]);
  });

  it("схвалювач іншого відділу не отримує імені автора заявки «Primary School»", async () => {
    const id = await submit(member1, PRIMARY);

    expect(await authorNames(pmApprover, [id])).toEqual([]);
  });

  it("заявник, який не автор, не отримує імені автора чужої заявки свого відділу", async () => {
    const id = await submit(member1, PRIMARY);

    expect(await authorNames(pmRequester, [id])).toEqual([]);
  });

  it("деактивований схвалювач не отримує імені автора", async () => {
    const id = await submit(member1, PRIMARY);
    await t.asService("update public.profiles set is_active = false where id = $1", [member2]);

    try {
      expect(await authorNames(member2, [id])).toEqual([]);
    } finally {
      await t.asService("update public.profiles set is_active = true where id = $1", [member2]);
    }
  });

  it("відвідувач без входу не викликає функцію — permission denied", async () => {
    const id = await submit(member1, PRIMARY);

    await expect(t.asAnon("select * from public.purchase_author_names($1::uuid[])", [[id]])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("кілька заявок одним викликом: імена лише видимих", async () => {
    const own = await submit(member1, PRIMARY);
    const office = await submit(admin, OFFICE);

    const rows = await authorNames(member2, [own, office]);

    expect(rows.map((r) => r.purchase_id)).toEqual([own]);
  });
});
