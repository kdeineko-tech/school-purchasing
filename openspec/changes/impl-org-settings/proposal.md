# План реалізації: impl-org-settings (зріз WS6)

## Why

Реалізуємо перший зріз Purchasing App — налаштування адміністратором: відділи, заявники, схвалювачі, автосхвалення,
деактивація працівників і захист активного адміністратора, дозволи й доступ до сторінок адміністратора, заглушка форми
заявки. Специфікація — `openspec/specs/{departments,staff-lifecycle,access-permissions}/spec.md` (зміна
`add-org-settings`), вимоги PM — знімок від 2026-10-22 (шапка `docs/conformance.md`).

## What Changes

Покриває всі 32 AC з `openspec/specs/`:

- `departments`: AC-ORG-01, AC-ORG-02, AC-ORG-03, AC-ORG-04, AC-ORG-05, AC-ORG-06, AC-ORG-14, AC-ORG-15, AC-ORG-19,
  AC-ORG-20, AC-ORG-24, AC-ORG-33, AC-ORG-34;
- `staff-lifecycle`: AC-ORG-10, AC-ORG-11, AC-ORG-12, AC-ORG-13, AC-ORG-16, AC-ORG-18, AC-ORG-21, AC-ORG-28,
  AC-ORG-30, AC-ORG-31, AC-ORG-32;
- `access-permissions`: AC-ORG-09, AC-ORG-17, AC-ORG-22, AC-ORG-23, AC-ORG-25, AC-ORG-26, AC-ORG-27, AC-ORG-29.

AC-ORG-13 до відповіді PM на Q2 (ValiaBihun/2026-quitcode-dream-team#43) лишається «відкладено»: у зрізі немає
чернеток (задача 8).
