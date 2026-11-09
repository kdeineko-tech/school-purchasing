// Номер і суми заявки (AC-HIST-01, AC-HIST-02). Суми — у доларах США, 2 знаки, округлення до центів: рахуємо в
// цілих центах, щоб 0.1 + 0.2 не давало 0.30000000000000004, і форматуємо лише для показу.

/** Номер заявки виду «PUR-1»; до застосування міграції номера ще немає — «—». */
export function formatNumber(number: number | null | undefined): string {
  // Number.isInteger відкидає null, undefined і дробові.
  return Number.isInteger(number) && Number(number) >= 1 ? `PUR-${number}` : "—";
}

type Amount = number | string | null | undefined;

const toNumber = (value: Amount): number | null => {
  // Number(undefined) — NaN, тож окремої перевірки не треба; а null і "" дали б 0.
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Центи — BigInt: ціна до 9 999 999 999.99 (numeric(12, 2)) — це до 10^12 центів, а кількість — ціле до ~2·10^9, тож
// добуток виходить за Number.MAX_SAFE_INTEGER (~9·10^15). Ціна в центах сама ще точна в number, далі — лише BigInt.
// Цільовий ES2017 не знає літералів 0n, тому BigInt(…).
const ZERO = BigInt(0);
const HUNDRED = BigInt(100);

const isInteger = (n: number | null): n is number => Number.isInteger(n);

/** Сума рядка в центах: кількість × ціна; без кількості чи ціни або з дробовою кількістю — null. */
export function lineTotal(quantity: Amount, unitPrice: Amount): bigint | null {
  const q = toNumber(quantity);
  const p = toNumber(unitPrice);
  // Кількість у базі — integer; дробову не множимо, бо BigInt її не прийме. null теж не ціле.
  if (!isInteger(q) || p === null) return null;
  return BigInt(q) * BigInt(Math.round(p * 100));
}

/** Сума заявки в центах — завжди за всіма рядками, зокрема для «Частково схвалено» (#65); рядки без суми — 0. */
export function purchaseTotal(lines: { quantity: Amount; unit_price: Amount }[]): bigint {
  return lines.reduce((sum, line) => sum + (lineTotal(line.quantity, line.unit_price) ?? ZERO), ZERO);
}

/** Центи → «91.00»; null — «—». */
export function formatCents(cents: bigint | null): string {
  if (cents === null) return "—";
  const negative = cents < ZERO;
  const abs = negative ? -cents : cents;
  return `${negative ? "-" : ""}${abs / HUNDRED}.${String(abs % HUNDRED).padStart(2, "0")}`;
}
