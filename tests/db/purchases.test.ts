import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Відмовні AC подання й перегляду закупівлі на справжньому Postgres (PGlite): RLS, GRANT і функція
// private.submit_purchase із supabase/migrations. Кожен тест перевіряє і відмову, і що дані не змінились.

const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const HIGH = "00000000-0000-4000-8000-0000000000d3";
const LINE = JSON.stringify([{ name: "Paper A4", purpose: "Printing", quantity: "3", unit_price: "20.00" }]);

let t: PurchasingDb;
let admin: string;
let member1: string;
let member2: string;
let purchaseOf1: string;

const countPurchases = async (authorId: string) =>
  Number((await t.asService<{ n: number }>("select count(*)::int as n from public.purchases where author_id = $1", [authorId]))[0].n);

beforeAll(async () => {
  t = await createPurchasingDb();
  admin = t.users["admin@example.test"];
  member1 = t.users["member1@example.test"];
  member2 = t.users["member2@example.test"];

  // Початкова школа: заявники — працівники 1 і 2; Вища школа — без них.
  await t.asService("insert into public.departments (id, name) values ($1, 'Primary School'), ($2, 'High School')", [
    PRIMARY,
    HIGH,
  ]);
  await t.asService("insert into public.department_members (profile_id, department_id) values ($1, $3), ($2, $3)", [
    member1,
    member2,
    PRIMARY,
  ]);
  [{ id: purchaseOf1 }] = await t.asUser<{ id: string }>(
    member1,
    "select public.submit_purchase($1, 'purchasing_department', $2::jsonb) as id",
    [PRIMARY, LINE],
  );
}, 60_000);

describe("подання закупівлі в базі", () => {
  it("AC-FRM-07: працівник 1 подає закупівлю у свій відділ — статус «Очікує схвалення», рядок збережено", async () => {
    const [p] = await t.asService<{ status: string }>("select status from public.purchases where id = $1", [purchaseOf1]);
    expect(p.status).toBe("awaiting_approval");
    const lines = await t.asService("select name from public.purchase_lines where purchase_id = $1", [purchaseOf1]);
    expect(lines).toEqual([{ name: "Paper A4" }]);
  });

  it("AC-FRM-02: подання у «Вищу школу», де працівник 1 не заявник, напряму через rpc — FORBIDDEN, нової заявки немає", async () => {
    const before = await countPurchases(member1);

    await expect(
      t.asUser(member1, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb)", [HIGH, LINE]),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(await countPurchases(member1)).toBe(before);
  });

  it("AC-FRM-02: прямий insert у purchases в обхід функції — permission denied, нової заявки немає", async () => {
    const before = await countPurchases(member1);

    await expect(
      t.asUser(
        member1,
        "insert into public.purchases (author_id, department_id, purchase_type) values ($1, $2, 'purchasing_department')",
        [member1, HIGH],
      ),
    ).rejects.toThrow(/permission denied/);
    expect(await countPurchases(member1)).toBe(before);
  });

  it("AC-FRM-04: «Самостійна закупівля» без дозволу напряму через rpc — FORBIDDEN, нової заявки немає", async () => {
    const before = await countPurchases(member1);

    await expect(
      t.asUser(member1, "select public.submit_purchase($1, 'self_purchase', $2::jsonb)", [PRIMARY, LINE]),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(await countPurchases(member1)).toBe(before);
  });

  it("AC-FRM-06: закупівля без жодного рядка — NO_LINES, нової заявки немає (і для NULL чи не-масиву)", async () => {
    const before = await countPurchases(member1);

    for (const lines of ["[]", null, "{}", "[1]"]) {
      await expect(
        t.asUser(member1, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb)", [PRIMARY, lines]),
      ).rejects.toThrow(/NO_LINES/);
    }
    expect(await countPurchases(member1)).toBe(before);
  });

  it("AC-ORG-23: адміністратор без дозволу подає «Самостійну закупівлю» у відділ, де він не заявник (AC-ORG-22)", async () => {
    const [{ id }] = await t.asUser<{ id: string }>(
      admin,
      "select public.submit_purchase($1, 'self_purchase', $2::jsonb) as id",
      [HIGH, LINE],
    );
    expect(id).toBeTruthy();
  });

  it("працівник не змінює статус заявки напряму — permission denied, статус не змінився", async () => {
    await expect(
      t.asUser(member1, "update public.purchases set status = 'approved' where id = $1", [purchaseOf1]),
    ).rejects.toThrow(/permission denied/);
    const [p] = await t.asService<{ status: string }>("select status from public.purchases where id = $1", [purchaseOf1]);
    expect(p.status).toBe("awaiting_approval");
  });
});

describe("хто бачить закупівлю в базі", () => {
  it("AC-FRM-08: працівник 2 — заявник того ж відділу, не автор і не схвалювач — не бачить закупівлі й рядків працівника 1", async () => {
    expect(await t.asUser(member2, "select id from public.purchases where id = $1", [purchaseOf1])).toHaveLength(0);
    expect(
      await t.asUser(member2, "select id from public.purchase_lines where purchase_id = $1", [purchaseOf1]),
    ).toHaveLength(0);
    const [p] = await t.asService<{ status: string }>("select status from public.purchases where id = $1", [purchaseOf1]);
    expect(p.status).toBe("awaiting_approval");
  });

  it("AC-FRM-10: працівник 1 бачить власну закупівлю", async () => {
    expect(await t.asUser(member1, "select id from public.purchases where id = $1", [purchaseOf1])).toHaveLength(1);
  });

  it("AC-FRM-09: гість без входу не читає закупівлі й не подає їх", async () => {
    await expect(t.asAnon("select id from public.purchases")).rejects.toThrow(/permission denied/);
    await expect(
      t.asAnon("select public.submit_purchase($1, 'purchasing_department', $2::jsonb)", [PRIMARY, LINE]),
    ).rejects.toThrow(/permission denied/);
  });

  it("схвалювач відділу бачить закупівлю свого відділу", async () => {
    await t.asService("update public.department_members set approves = true where profile_id = $1 and department_id = $2", [
      member2,
      PRIMARY,
    ]);
    try {
      expect(await t.asUser(member2, "select id from public.purchases where id = $1", [purchaseOf1])).toHaveLength(1);
    } finally {
      await t.asService(
        "update public.department_members set approves = false where profile_id = $1 and department_id = $2",
        [member2, PRIMARY],
      );
    }
  });
});
