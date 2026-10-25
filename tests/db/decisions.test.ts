import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Рішення схвалювача на справжньому Postgres (PGlite): функція private.decide_purchase і RLS із
// supabase/migrations. Кожен відмовний тест перевіряє і відмову, і що статус заявки не змінився.

const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const OFFICE = "00000000-0000-4000-8000-0000000000d2";
const LINE = JSON.stringify([{ name: "Paper A4", purpose: "Printing", quantity: "3", unit_price: "20.00" }]);

let t: PurchasingDb;
let admin: string;
let member1: string; // працівник 1 — заявник «Primary School»
let member2: string; // Марія — заявник і схвалювач «Primary School», не схвалює «Office»

const submit = async (author: string, department: string) =>
  (
    await t.asUser<{ id: string }>(author, "select public.submit_purchase($1, 'purchasing_department', $2::jsonb) as id", [
      department,
      LINE,
    ])
  )[0].id;

const decide = (who: string, purchaseId: string, decision: string, reason: string | null = null) =>
  t.asUser(who, "select public.decide_purchase($1, $2, $3)", [purchaseId, decision, reason]);

const stateOf = async (purchaseId: string) =>
  (
    await t.asService<{ status: string; rejection_reason: string | null; decided_by: string | null }>(
      "select status, rejection_reason, decided_by from public.purchases where id = $1",
      [purchaseId],
    )
  )[0];

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

describe("рішення схвалювача в базі", () => {
  it("AC-APR-02: Марія схвалює заявку свого відділу, автор якої не вона, — статус «Схвалено»", async () => {
    const id = await submit(member1, PRIMARY);

    await decide(member2, id, "approve");

    expect(await stateOf(id)).toEqual({ status: "approved", rejection_reason: null, decided_by: member2 });
  });

  it("AC-APR-07: Марія відхиляє заявку з причиною «Немає бюджету» — статус «Відхилено», причину збережено", async () => {
    const id = await submit(member1, PRIMARY);

    await decide(member2, id, "reject", "Немає бюджету");

    expect(await stateOf(id)).toEqual({ status: "rejected", rejection_reason: "Немає бюджету", decided_by: member2 });
  });

  it("AC-APR-06: відхилення без причини напряму через rpc — REASON_REQUIRED, статус «Очікує схвалення»", async () => {
    const id = await submit(member1, PRIMARY);

    for (const reason of [null, "", "   "]) {
      await expect(decide(member2, id, "reject", reason)).rejects.toThrow(/REASON_REQUIRED/);
    }
    expect((await stateOf(id)).status).toBe("awaiting_approval");
  });

  it("AC-APR-03: Марія, яка схвалює лише «Primary School», не вирішує заявку «Office» — FORBIDDEN, статус той самий", async () => {
    const id = await submit(admin, OFFICE);

    await expect(decide(member2, id, "approve")).rejects.toThrow(/FORBIDDEN/);
    await expect(decide(member2, id, "reject", "Немає бюджету")).rejects.toThrow(/FORBIDDEN/);
    expect((await stateOf(id)).status).toBe("awaiting_approval");
  });

  it("AC-APR-03: Марія не бачить заявки відділу «Office» за прямим запитом", async () => {
    const id = await submit(admin, OFFICE);

    expect(await t.asUser(member2, "select id from public.purchases where id = $1", [id])).toHaveLength(0);
  });

  it("AC-APR-04: працівник 1 з роллю requester не вирішує заявку — FORBIDDEN, статус той самий", async () => {
    const id = await submit(member2, PRIMARY);

    await expect(decide(member1, id, "approve")).rejects.toThrow(/FORBIDDEN/);
    expect((await stateOf(id)).status).toBe("awaiting_approval");
  });

  it("AC-APR-04: заявник не бачить чужих заявок свого відділу, тож і списку для рішення", async () => {
    await submit(member2, PRIMARY);

    const visible = await t.asUser<{ author_id: string }>(member1, "select author_id from public.purchases");
    expect(visible.every((p) => p.author_id === member1)).toBe(true);
  });

  it("AC-APR-05: Марія — схвалювач і автор — не схвалює власну заявку напряму — FORBIDDEN, статус той самий", async () => {
    const id = await submit(member2, PRIMARY);

    await expect(decide(member2, id, "approve")).rejects.toThrow(/FORBIDDEN/);
    expect((await stateOf(id)).status).toBe("awaiting_approval");
  });

  it("AC-FRM-13: заявка єдиного схвалювача-автора чекає, доки її не вирішить інший схвалювач", async () => {
    const id = await submit(member2, PRIMARY);
    await expect(decide(member2, id, "approve")).rejects.toThrow(/FORBIDDEN/);
    expect((await stateOf(id)).status).toBe("awaiting_approval");

    await t.asService("insert into public.department_members (profile_id, department_id, approves) values ($1, $2, true)", [
      admin,
      PRIMARY,
    ]);
    try {
      await decide(admin, id, "approve");
      expect(await stateOf(id)).toMatchObject({ status: "approved", decided_by: admin });
    } finally {
      await t.asService("delete from public.department_members where profile_id = $1 and department_id = $2", [admin, PRIMARY]);
    }
  });

  it("вирішену заявку вдруге не вирішити — NOT_PENDING, рішення те саме", async () => {
    const id = await submit(member1, PRIMARY);
    await decide(member2, id, "approve");

    await expect(decide(member2, id, "reject", "Немає бюджету")).rejects.toThrow(/NOT_PENDING/);
    expect((await stateOf(id)).status).toBe("approved");
  });

  it("схвалювач не змінює статус напряму в обхід функції — permission denied", async () => {
    const id = await submit(member1, PRIMARY);

    await expect(
      t.asUser(member2, "update public.purchases set status = 'approved' where id = $1", [id]),
    ).rejects.toThrow(/permission denied/);
    expect((await stateOf(id)).status).toBe("awaiting_approval");
  });

  it("гість не викликає decide_purchase", async () => {
    const id = await submit(member1, PRIMARY);

    await expect(t.asAnon("select public.decide_purchase($1, 'approve', null)", [id])).rejects.toThrow(
      /permission denied/,
    );
    expect((await stateOf(id)).status).toBe("awaiting_approval");
  });
});
