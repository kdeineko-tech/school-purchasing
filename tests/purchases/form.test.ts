import { describe, expect, it } from "vitest";
import { MESSAGES } from "@/lib/org/messages";
import { formDepartments, formPurchaseTypes, parseLines, validateSubmission } from "@/lib/purchases/form";
import { ADMIN, HIGH, OFFICE, P1, PRIMARY } from "./fake-db";

const departments = [PRIMARY, OFFICE, HIGH];
const noPermissions = { canCardExpense: false, canCheckRequest: false, canVendorInvoice: false, canSelfPurchase: false };
const line = { name: "Paper A4", purpose: "Printing", quantity: "3", unitPrice: "20.00" };

describe("відділи у формі закупівлі", () => {
  it("AC-FRM-01: працівнику — заявнику «Початкова школа» й «Офіс» у виборі відділу лише вони, «Вищої школи» немає", () => {
    const memberships = [
      { profileId: P1, departmentId: PRIMARY.id },
      { profileId: P1, departmentId: OFFICE.id },
    ];

    const names = formDepartments({ id: P1, role: "requester" }, memberships, departments).map((d) => d.name);

    expect(names).toEqual(["Office", "Primary School"]);
    expect(names).not.toContain("High School");
  });

  it("AC-FRM-05: у працівника без ролі admin і без відділів список відділів порожній", () => {
    expect(formDepartments({ id: P1, role: "requester" }, [], departments)).toEqual([]);
  });

  it("AC-ORG-22: адміністратор без відділів обирає будь-який відділ зі списку всіх відділів", () => {
    expect(formDepartments({ id: ADMIN, role: "admin" }, [], departments)).toHaveLength(3);
  });

  it("AC-ORG-29: адміністратор — заявник лише «Початкова школа» обирає будь-який відділ, зокрема «Офіс»", () => {
    const memberships = [{ profileId: ADMIN, departmentId: PRIMARY.id }];

    const names = formDepartments({ id: ADMIN, role: "admin" }, memberships, departments).map((d) => d.name);

    expect(names).toContain("Office");
    expect(names).toHaveLength(3);
  });
});

describe("типи закупівлі у формі", () => {
  it("AC-FRM-03: без ролі admin і без дозволу «Self-purchase» у виборі типу лише «Purchasing department»", () => {
    expect(formPurchaseTypes({ ...noPermissions, role: "requester" })).toEqual(["purchasing_department"]);
  });

  it("AC-ORG-23: адміністратор без дозволу «Self-purchase» обирає будь-який тип, зокрема «Self-purchase»", () => {
    expect(formPurchaseTypes({ ...noPermissions, role: "admin" })).toEqual(["purchasing_department", "self_purchase"]);
  });

  it("з дозволом «Self-purchase» працівнику доступні обидва типи", () => {
    expect(formPurchaseTypes({ ...noPermissions, canSelfPurchase: true, role: "requester" })).toHaveLength(2);
  });
});

describe("перевірка подання", () => {
  const options = { departments: [PRIMARY], purchaseTypes: ["purchasing_department" as const] };

  it("AC-FRM-02: подання у відділ, де працівник не заявник, — «Not enough permissions»", () => {
    expect(validateSubmission({ departmentId: HIGH.id, purchaseType: "purchasing_department", lines: [line] }, options)).toEqual({
      ok: false,
      error: MESSAGES.forbidden,
    });
  });

  it("AC-FRM-04: «Self-purchase» без дозволу — «Not enough permissions»", () => {
    expect(validateSubmission({ departmentId: PRIMARY.id, purchaseType: "self_purchase", lines: [line] }, options)).toEqual({
      ok: false,
      error: MESSAGES.forbidden,
    });
  });

  it("AC-FRM-06: закупівля без жодного рядка не подається — «Add at least one line»", () => {
    expect(validateSubmission({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: [] }, options)).toEqual({
      ok: false,
      error: "Add at least one line",
    });
  });

  it("AC-FRM-07: один рядок у своєму відділі дозволеного типу можна подати", () => {
    expect(
      validateSubmission({ departmentId: PRIMARY.id, purchaseType: "purchasing_department", lines: [line] }, options),
    ).toEqual({ ok: true });
  });

  it("рядки з поля форми: не масив чи зіпсований JSON — рядків немає, не-об'єкти відкинуто", () => {
    expect(parseLines(undefined)).toEqual([]);
    expect(parseLines("{oops")).toEqual([]);
    expect(parseLines("{}")).toEqual([]);
    expect(parseLines(JSON.stringify([1, null, line]))).toEqual([line]);
  });
});
