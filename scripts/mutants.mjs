// Мутанти для scripts/mutation-check.mjs (npm run mutation:sql). Мутант = одне правило з AC, навмисно зламане.
// Джерело формату — демо-репо курсу, scripts/mutants.mjs (тег ws8-02-tests); там 11 SQL- і 2 TS-мутанти.
// Поля:
//   id, kind ("sql" | "ts"), ac (який AC це правило доводить), what (що зламано — людською мовою);
//   file — що мутуємо; tests — файли тестів, які мають довести правило (саме їх і запускаємо);
//   find — рядок або RegExp, що трапляється у файлі РІВНО один раз (надійніше за номери рядків, які зсуваються);
//   replace — заміна (вставляється буквально: «$$» у plpgsql лишається «$$»);
//   expect: "survive" + reason — лише для еквівалентного мутанта (поведінка не змінюється) з посиланням на те,
//   що робить його еквівалентним (рядок міграції, інший тест). Без reason скрипт мутант не приймає.
// Новий AC з відмовою, правило якого живе в SQL (політика, grant, функція, тригер), — новий мутант тут.
//
// School Purchasing: правила в SQL за AC зрізу 2, обраними для WS8 (AC-APR-04, AC-FRM-06; AC-FRM-03 — лише TS,
// його доводить Stryker). Гарнес — наш tests/db/supabase-pglite.ts; P1/P2 з матеріалів не беремо: їхній
// tests/db/profiles-db.test.ts перевіряв гарнес шаблону, а наш гарнес уже перевіряють тести бази зрізів 1–2.
const PURCHASES = "supabase/migrations/20261025185729_purchases.sql";
const DECISIONS = "supabase/migrations/20261025223225_purchase_decisions.sql";
const LINE_FIELDS = "supabase/migrations/20261026100553_purchase_line_fields.sql";
const PURCHASES_DB = "tests/db/purchases.test.ts";
const DECISIONS_DB = "tests/db/decisions.test.ts";

export const mutants = [
  {
    id: "A1", kind: "sql", ac: "AC-APR-04", file: DECISIONS, tests: [DECISIONS_DB],
    what: "decide_purchase: вирішує будь-хто з відділу заявки, а не лише його схвалювач (прибрано `and m.approves`)",
    find: "where m.profile_id = v_uid and m.department_id = v_purchase.department_id and m.approves\n",
    replace: "where m.profile_id = v_uid and m.department_id = v_purchase.department_id\n",
  },
  {
    id: "A2", kind: "sql", ac: "AC-APR-04", file: PURCHASES, tests: [DECISIONS_DB],
    what: "purchases_select_visible: заявки відділу бачить будь-хто з входом, а не лише схвалювач відділу",
    find: "create policy purchases_select_visible\n  on public.purchases\n  for select\n  to authenticated\n  using (\n    (select private.is_active_user())\n    and (\n      author_id = (select auth.uid())\n      or (select private.approves_department(department_id))",
    replace: "create policy purchases_select_visible\n  on public.purchases\n  for select\n  to authenticated\n  using (\n    (select private.is_active_user())\n    and (\n      author_id = (select auth.uid())\n      or true",
  },
  {
    id: "F1", kind: "sql", ac: "AC-FRM-06", file: LINE_FIELDS, tests: [PURCHASES_DB],
    what: "submit_purchase: порожній масив рядків більше не дає NO_LINES",
    find: "  if jsonb_array_length(p_lines) = 0 then\n",
    replace: "  if false then\n",
  },
  // ── Ваші мутанти: по одному на правило в SQL за кожним із ваших 3 AC ──────────────────────────────────────────
];

// Приклади з демо (інша схема — у вашому репо цих файлів немає, тож не розкоментовуйте як є):
//
// SQL, межа з AC — діапазон напіввідкритий, останній день заявки не рахується:
//   { id: "L2", kind: "sql", ac: "AC-LEAVE-11", file: RULES, tests: [LEAVE_DB],
//     what: "перетин: діапазон НОВОЇ заявки напіввідкритий [початок, кінець)",
//     find: "pg_catalog.daterange(p_start_date, p_end_date, '[]')",
//     replace: "pg_catalog.daterange(p_start_date, p_end_date, '[)')" },
//
// SQL, політика послаблена до true (а не видалена: без політики RLS забороняє все, і тест відмови лишився б зеленим):
//   { id: "L5", kind: "sql", ac: "передумова AC-LEAVE-04/10", file: LEAVE, tests: [LEAVE_DB],
//     what: "blocked_days: insert дозволено будь-кому з входом, а не лише адміністратору",
//     find: "on public.blocked_days for insert to authenticated\n  with check ((select private.current_app_role()) = 'admin');",
//     replace: "on public.blocked_days for insert to authenticated\n  with check (true);" },
//
// Еквівалентний мутант — лише з reason, що посилається на рядок, який робить його зайвим:
//   { id: "L6", kind: "sql", ac: "AC-LEAVE-06/07", file: RECORDS, tests: [LEAVE_DB],
//     what: "політика рішень: прибрано role = 'manager'", expect: "survive",
//     reason: "еквівалентний: з 20261018000000_manager_helpers_require_role.sql private.is_division_manager() сама " +
//       "перевіряє current_app_role() = 'manager'", find: "…", replace: "…" },
//
// TS, точковий мутант на межі з AC (повний перебір TS — npm run mutation:ts, Stryker):
//   { id: "T1", kind: "ts", ac: "AC-LEAVE-11", file: "src/lib/leave/calendar.ts", tests: ["tests/leave/calendar.test.ts"],
//     what: "rangesOverlap: <= → <", find: "b.startDate <= a.endDate", replace: "b.startDate < a.endDate" },
