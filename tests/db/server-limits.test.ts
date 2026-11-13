import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Серверні ліміти (зауваження PM 5, kdeineko-tech/school-purchasing#70) на справжньому Postgres (PGlite):
// supabase/migrations/20261113115937_server_limits.sql. Не AC PM, а захист від прямого виклику rpc в обхід форми:
// не більше 100 рядків на заявку, назва й мета рядка, причина відхилення й причина повернення — не довші за 500 символів.
// Кожна відмова перевіряє, що нічого не записано.

const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const line = (name = "Paper A4", purpose = "Classes") => ({ name, purpose, quantity: "2", unit_price: "5.00" });
const lines = (...items: object[]) => JSON.stringify(items);
const repeat = (n: number) => Array.from({ length: n }, () => line());

describe("серверні ліміти в базі", () => {
  let t: PurchasingDb;
  let member1: string; // заявник «Primary School»
  let member2: string; // схвалювач «Primary School»

  const submit = (who: string, json: string) =>
    t.asUser<{ id: string }>(who, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb) as id", [
      PRIMARY,
      json,
    ]);
  const decide = (id: string, decision: string, reason: string) =>
    t.asUser(member2, "select public.decide_purchase($1, $2, $3)", [id, decision, reason]);
  const count = async (sql: string, params: unknown[] = []) =>
    Number((await t.asService<{ n: string }>(sql, params))[0].n);
  const purchasesOf = (who: string) => count("select count(*) as n from public.purchases where author_id = $1", [who]);

  beforeAll(async () => {
    t = await createPurchasingDb();
    member1 = t.users["member1@example.test"];
    member2 = t.users["member2@example.test"];
    await t.asService("insert into public.departments (id, name) values ($1, 'Primary School')", [PRIMARY]);
    await t.asService(
      "insert into public.department_members (profile_id, department_id, approves) values ($1, $3, false), ($2, $3, true)",
      [member1, member2, PRIMARY],
    );
  }, 60_000);

  it("100 рядків — заявку подано; 101 — TOO_MANY_LINES, заявки немає", async () => {
    const before = await purchasesOf(member1);

    const [{ id }] = await submit(member1, lines(...repeat(100)));
    expect(await count("select count(*) as n from public.purchase_lines where purchase_id = $1", [id])).toBe(100);

    await expect(submit(member1, lines(...repeat(101)))).rejects.toThrow(/TOO_MANY_LINES/);
    expect(await purchasesOf(member1)).toBe(before + 1);
  });

  it("назва чи мета рівно 500 символів (пробіли навколо не рахуються) — подано; 501 — LINE_TOO_LONG, заявки немає", async () => {
    const before = await purchasesOf(member1);
    const max = "я".repeat(500);

    await submit(member1, lines(line(`  ${max}  `, max)));
    await expect(submit(member1, lines(line(), line(`${max}я`)))).rejects.toThrow(/LINE_TOO_LONG/);
    await expect(submit(member1, lines(line("Pens", `${max}я`)))).rejects.toThrow(/LINE_TOO_LONG/);
    expect(await purchasesOf(member1)).toBe(before + 1);
  });

  it("повторне подання — ті самі ліміти: TOO_MANY_LINES і LINE_TOO_LONG, заявка лишається поверненою", async () => {
    const [{ id }] = await submit(member1, lines(line()));
    await decide(id, "return", "Уточніть кількість");
    const resubmit = (json: string) =>
      t.asUser(member1, "select public.resubmit_purchase($1, $2::jsonb)", [id, json]);

    await expect(resubmit(lines(...repeat(101)))).rejects.toThrow(/TOO_MANY_LINES/);
    await expect(resubmit(lines(line("x".repeat(501))))).rejects.toThrow(/LINE_TOO_LONG/);

    const [state] = await t.asService<{ status: string }>("select status from public.purchases where id = $1", [id]);
    expect(state.status).toBe("returned");
    expect(await count("select count(*) as n from public.purchase_lines where purchase_id = $1", [id])).toBe(1);
  });

  it("причина відхилення чи повернення понад 500 символів — відмова check, заявка чекає", async () => {
    const [{ id }] = await submit(member1, lines(line()));

    for (const decision of ["reject", "return"]) {
      await expect(decide(id, decision, "r".repeat(501))).rejects.toThrow(/_reason_length/);
    }
    const [state] = await t.asService<{ status: string }>("select status from public.purchases where id = $1", [id]);
    expect(state.status).toBe("awaiting_approval");

    await decide(id, "reject", "r".repeat(500));
  });

  it("друга лінія — check у таблицях тримає навіть service_role", async () => {
    const [{ id }] = await submit(member1, lines(line()));

    await expect(
      t.asService("update public.purchase_lines set name = $2 where purchase_id = $1", [id, "x".repeat(501)]),
    ).rejects.toThrow(/purchase_lines_name_length/);
    await expect(
      t.asService("update public.purchase_lines set purpose = $2 where purchase_id = $1", [id, "x".repeat(501)]),
    ).rejects.toThrow(/purchase_lines_purpose_length/);
    await expect(
      t.asService("update public.purchases set status = 'returned', return_reason = $2 where id = $1", [id, "x".repeat(501)]),
    ).rejects.toThrow(/purchases_return_reason_length/);
  });
});
