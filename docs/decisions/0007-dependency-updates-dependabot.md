# 0007. Оновлення залежностей через Dependabot у межах ліній стеку

- Статус: прийнято
- Дата: 2026-11-24
- AC: — (стек і збірка; поведінку жодного AC не змінює)

## Контекст

`AGENTS.md` («Стек і версії») забороняє оновлювати стек без ADR. З WS11 оновлення приносить Dependabot
(`.github/dependabot.yml`: щотижня, `cooldown` 7 днів, групи `npm-minor-and-patch` і `github-actions`). Перший
груповий PR #86 (20 оновлень) мав зелений CI, але червоний деплой Vercel: `npm error code ERESOLVE`.

- `@vitest/eslint-plugin` 1.6.28 (patch) вимагає peer `typescript >=6.0.0`; у нас `typescript` 5.9.3, а
  `typescript-eslint` 8 допускає лише `<6.1.0`.
- CI ставить залежності `npm ci` строго за `package-lock.json`, а Vercel для npm за замовчуванням робить
  `npm install`, який заново розв'язує peer-залежності. CI перевіряв інше дерево, ніж те, що збирав Vercel.
- Ще #86 підняв OpenSpec 1.14.1 → 1.17.0 (знахідка CodeRabbit у #90), а `AGENTS.md` фіксує 1.14.1 разом із
  глобальним CLI, і скіли та команди `/opsx:*` згенеровано саме ним.

Той самий випадок розібрано в демо курсу: https://github.com/koldovsky/2026-quitcode-06-leave-portal-demo/pull/46.

## Рішення

- **Приймаємо з #86** patch- і minor-оновлення в межах ліній стеку з `AGENTS.md`: `next` 16.4.6 (доповнення ADR 0002),
  React 19.3.1, `@supabase/supabase-js` 2.117.3 → 2.119.0, Supabase CLI 2.120.0 → 2.122.1, Vitest 5.1.0, `ai`
  7.0.173 (ADR 0006: та сама мажорна версія) та інші інструменти розробки. Рядок стеку в `AGENTS.md` оновлено
  (Supabase 2.119 і CLI 2.122).
- **Не приймаємо:** `@vitest/eslint-plugin` лишається 1.6.27; OpenSpec лишається 1.14.1. Для обох — `ignore` у
  `.github/dependabot.yml` з коментарем (чому, звідки, коли прибрати).
- **`vercel.json`: `"installCommand": "npm ci"`** — Vercel ставить рівно те дерево, яке перевірив CI.
- Мажорні оновлення (`typescript` 7, `eslint` 10, `@types/node` 26 — PR #87–#89) не зливаємо до demo day; кожне —
  окремим PR з ADR.

## Розглянуті варіанти

- Злити #86 як є — деплой падає (`ERESOLVE`), прод не оновиться.
- `--legacy-peer-deps` на Vercel — приховує конфлікт, а не прибирає його; плагін лінтера з несумісною версією
  `typescript` може зламатися пізніше.
- Оновити лише `next` власним PR — зараховується, але Dependabot щотижня знову принесе ті самі конфлікти; правило
  `ignore` і `npm ci` закривають причину.
- Оновити OpenSpec до 1.17.0 — потребує `openspec update` з профілем custom і перевірки згенерованих скілів; це
  окрема задача.

## Наслідки

- Перед злиттям PR Dependabot дивимось **усі** статуси, зокрема деплой preview Vercel, а не лише CI.
- Нове patch/minor-оновлення в межах тих самих ліній стеку — через PR Dependabot без нового ADR; перехід на іншу
  мінорну лінію Next.js або будь-яку мажорну версію стеку — новим ADR.
- `ignore` для `@vitest/eslint-plugin` прибираємо разом із переходом на TypeScript 6; для OpenSpec — разом з
  оновленням OpenSpec.
