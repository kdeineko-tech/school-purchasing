import { beforeAll, describe, expect, it } from "vitest";
import { createPurchasingDb, type PurchasingDb } from "./supabase-pglite";

// Роль у public.profiles, яку база рахує за відділами (ADR docs/decisions/0004-role-in-profiles-table.md), на
// справжньому Postgres (PGlite): тригери private.sync_role і private.guard_profile_admin_columns, RLS.

const PRIMARY = "00000000-0000-4000-8000-0000000000d1";
const OFFICE = "00000000-0000-4000-8000-0000000000d2";

let t: PurchasingDb;
let admin: string;
let member1: string;
let member2: string;

const roleOf = async (id: string) =>
  (await t.asService<{ role: string }>("select role from public.profiles where id = $1", [id]))[0].role;

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
    "insert into public.department_members (profile_id, department_id) values ($1, $3), ($1, $4), ($2, $3)",
    [member1, member2, PRIMARY, OFFICE],
  );
}, 60_000);

const setApproves = (profileId: string, departmentId: string, approves: boolean) =>
  t.asUser(admin, "update public.department_members set approves = $3 where profile_id = $1 and department_id = $2", [
    profileId,
    departmentId,
    approves,
  ]);

describe("роль за відділами в базі", () => {
  it("AC-ORG-05: адміністратор призначає працівника 1 схвалювачем «Primary School» — роль стає approver", async () => {
    await setApproves(member1, PRIMARY, true);
    expect(await roleOf(member1)).toBe("approver");
  });

  it("AC-ORG-19: схвалювач двох відділів після зняття з одного лишається approver", async () => {
    await setApproves(member1, OFFICE, true);
    await setApproves(member1, OFFICE, false);
    expect(await roleOf(member1)).toBe("approver");
  });

  it("AC-ORG-04: зняття зі схвалювачів єдиного відділу повертає роль requester", async () => {
    await setApproves(member1, PRIMARY, false);
    expect(await roleOf(member1)).toBe("requester");
  });

  it("AC-ORG-24: зняття заявника єдиного відділу, який він схвалював, повертає роль requester", async () => {
    await setApproves(member2, PRIMARY, true);
    expect(await roleOf(member2)).toBe("approver");

    await t.asUser(admin, "delete from public.department_members where profile_id = $1 and department_id = $2", [
      member2,
      PRIMARY,
    ]);
    expect(await roleOf(member2)).toBe("requester");
  });
});

describe("роль не змінює сам працівник", () => {
  it("AC-ORG-09: працівник без ролі admin не робить себе адміністратором оновленням профілю — FORBIDDEN, роль та сама", async () => {
    await expect(
      t.asUser(member1, "update public.profiles set role = 'admin' where id = $1", [member1]),
    ).rejects.toThrow(/FORBIDDEN/);
    expect(await roleOf(member1)).toBe("requester");
  });

  it("AC-ORG-09: працівник без ролі admin не робить себе схвалювачем відділу — 0 рядків, роль та сама", async () => {
    await t.asService("insert into public.department_members (profile_id, department_id) values ($1, $2)", [
      member2,
      PRIMARY,
    ]);
    const updated = await t.asUser(
      member2,
      "update public.department_members set approves = true where profile_id = $1 and department_id = $2 returning profile_id",
      [member2, PRIMARY],
    );
    expect(updated).toHaveLength(0);
    expect(await roleOf(member2)).toBe("requester");
  });

  it("AC-ORG-12: деактивований працівник з чинною сесією не бачить відділів і не має ролі в політиках", async () => {
    await t.asService("update public.profiles set is_active = false where id = $1", [member1]);
    try {
      expect(await t.asUser(member1, "select id from public.departments")).toHaveLength(0);
      const [{ role }] = await t.asUser<{ role: string | null }>(member1, "select private.current_app_role() as role");
      expect(role).toBeNull();
    } finally {
      await t.asService("update public.profiles set is_active = true where id = $1", [member1]);
    }
  });
});
