# Дизайн-система: School Purchasing

- **Джерело:** артефакт Claude Design (Design System) — https://claude.ai/artifact/HHx1LvhQe5MeYqef7joXb3 (приватний; знімок — в описі PR). Створено в Claude Code з «Вигляду й тону» PM і наявного `src/app/globals.css`.
- **Вхід від PM:** розділ «Вигляд і тон» у `requirements/product.md` (знімок 2026-10-25).
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui і обгортки застосунку в `src/components/ui/index.tsx`); перевірка — `npm run check:design`.

## 1. Огляд

Застосунок закупівель школи: працівник подає закупівлю у свій відділ, схвалювач вирішує, адміністратор налаштовує відділи й права. Користуються з комп'ютера й телефона. Тон — спокійний, діловий, уважний до людей; без жартів, окликів, яскравих градієнтів і дрібного сірого тексту. Щільність важливіша за простір у списках (схвалювач бачить багато рядків без прокручування), а форма проста: одне поле на рядок, великі зони натискання. Інтерфейс англійською; дані, які ввели люди, — як введено.

## 2. Кольори

Семантичні токени з іменами shadcn/ui, значення — OKLCH. У сторінках — лише утиліти з колонки «Клас», ніколи hex, `bg-[#…]` чи сирі палітри (`zinc-500`, `bg-white`). Темна тема — за системою (`prefers-color-scheme`), ті самі назви токенів.

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.975 0.004 265)` / `oklch(0.21 0.015 265)` | `oklch(0.165 0.012 265)` / `oklch(0.94 0.008 265)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, форми, таблиці | `oklch(1 0 0)` / `oklch(0.21 0.015 265)` | `oklch(0.21 0.014 265)` / `oklch(0.94 0.008 265)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | діалоги, випадні списки | `oklch(1 0 0)` / `oklch(0.21 0.015 265)` | `oklch(0.21 0.014 265)` / `oklch(0.94 0.008 265)` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | одна основна дія на екран («Submit», «Approve»), посилання, знак «S» | `oklch(0.49 0.2 275)` / `oklch(0.99 0.003 265)` | `oklch(0.72 0.13 275)` / `oklch(0.165 0.012 265)` | `bg-primary`, `text-primary-foreground`, `text-primary` |
| `secondary` / `secondary-foreground` | другорядна дія («Add line», «Remove»), значок ролі | `oklch(0.955 0.008 265)` / `oklch(0.21 0.015 265)` | `oklch(0.27 0.015 265)` / `oklch(0.94 0.008 265)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | приглушене тло (відмова, заголовок таблиці), підписи й мета-текст | `oklch(0.955 0.008 265)` / `oklch(0.47 0.02 265)` | `oklch(0.27 0.015 265)` / `oklch(0.75 0.02 265)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | наведення, вибраний рядок, повідомлення про успіх, значок адміністратора | `oklch(0.95 0.03 275)` / `oklch(0.4 0.17 275)` | `oklch(0.28 0.06 275)` / `oklch(0.86 0.07 275)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-foreground` | лише «Reject» і текст помилки введення | `oklch(0.5 0.19 27)` / `oklch(0.99 0.003 265)` | `oklch(0.7 0.16 25)` / `oklch(0.165 0.012 265)` | `bg-destructive`, `text-destructive` |
| `border` | декоративні межі карток, роздільники рядків | `oklch(0.91 0.008 265)` | `oklch(0.31 0.015 265)` | `border-border` |
| `input` | межа поля вводу й контурної кнопки | `oklch(0.6 0.02 265)` | `oklch(0.56 0.02 265)` | `border-input` |
| `ring` | кільце фокусу | `oklch(0.49 0.2 275)` | `oklch(0.72 0.13 275)` | `ring-ring`, `outline-ring` |
| `status-pending` / `status-pending-foreground` | статус «Awaiting approval» — теплий жовтий | `oklch(0.95 0.07 88)` / `oklch(0.42 0.1 68)` | `oklch(0.31 0.06 80)` / `oklch(0.88 0.12 88)` | `bg-status-pending`, `text-status-pending-foreground` |
| `status-approved` / `status-approved-foreground` | статус «Approved» — зелений | `oklch(0.95 0.05 152)` / `oklch(0.42 0.11 152)` | `oklch(0.3 0.05 152)` / `oklch(0.86 0.12 152)` | `bg-status-approved`, `text-status-approved-foreground` |
| `status-rejected` / `status-rejected-foreground` | статус «Rejected» — червоний | `oklch(0.95 0.03 25)` / `oklch(0.47 0.17 27)` | `oklch(0.31 0.06 25)` / `oklch(0.84 0.09 25)` | `bg-status-rejected`, `text-status-rejected-foreground` |

Правила за змістом (з «Вигляду й тону» PM):

- `primary` — одна основна дія на екрані; той самий колір на всіх екранах.
- `destructive` — лише небезпечна або незворотна дія («Reject») і текст помилки введення; не для звичайних повідомлень.
- Відмова «Not enough permissions» — нейтральна (`bg-muted text-foreground`), не червона: людина нічого не зламала.
- Статус завжди має текст; колір лише підсилює.

### Контраст

Пораховано за WCAG 2 (OKLCH → sRGB) для кожної пари в обох темах.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 16,5 | 16,2 | ≥ 4.5 |
| `foreground` на `card` | 17,7 | 14,9 | ≥ 4.5 |
| `muted-foreground` на `background` | 6,4 | 8,7 | ≥ 4.5 |
| `muted-foreground` на `card` | 6,8 | 8,0 | ≥ 4.5 |
| `muted-foreground` на `muted` | 6,0 | 6,8 | ≥ 4.5 |
| `primary-foreground` на `primary` | 6,5 | 7,6 | ≥ 4.5 |
| `primary` на `card` (посилання) | 6,7 | 7,0 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 15,6 | 12,6 | ≥ 4.5 |
| `accent-foreground` на `accent` | 8,4 | 9,6 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 6,4 | 6,7 | ≥ 4.5 |
| `destructive` на `card` | 6,6 | 6,2 | ≥ 4.5 |
| `status-pending-foreground` на `status-pending` | 7,4 | 9,2 | ≥ 4.5 |
| `status-approved-foreground` на `status-approved` | 7,1 | 9,1 | ≥ 4.5 |
| `status-rejected-foreground` на `status-rejected` | 6,3 | 8,0 | ≥ 4.5 |
| `input` на `card` | 3,9 | 3,8 | ≥ 3 |
| `input` на `background` | 3,7 | 4,1 | ≥ 3 |
| `ring` на `background` | 6,3 | 7,6 | ≥ 3 |
| `ring` на `card` | 6,7 | 7,0 | ≥ 3 |

## 3. Типографіка

Шрифт — Geist (`next/font`, `--font-sans`), моно — Geist Mono. Найменший текст — 13px (`text-[13px]` не використовуємо: `text-sm` 14px для тексту, `text-xs` 12px лише на значках). Числа в таблицях — `tabular-nums`.

| Роль | Клас | Де |
|---|---|---|
| Заголовок сторінки | `text-2xl font-semibold tracking-tight` | один на сторінку (`PageShell`) |
| Заголовок картки | `text-sm font-semibold uppercase tracking-wide text-muted-foreground` | `Card title` |
| Основний текст | `text-sm` | рядки, поля, таблиці |
| Назва в рядку, кнопка | `text-sm font-medium` | список заявок, кнопки |
| Підпис, мета | `text-sm text-muted-foreground` | тип · дата під рядком, `dt` у списках |
| Значок | `text-xs font-medium` | лише `Badge` |

## 4. Відступи й радіуси

- Сітка 4px: `gap-2` між полями й кнопками, `py-3` рядок списку, `p-5` картка, `gap-6` між картками, `px-4` (телефон) / `px-6` бічні відступи сторінки, `py-8` вертикальний відступ сторінки.
- Ширина вмісту — `max-w-4xl mx-auto`; на телефоні все в одну колонку (`sm:` вмикає дві).
- Радіус `--radius: 0.75rem`: `rounded-md` поля й кнопки, `rounded-lg`/`rounded-xl` картки й діалоги, `rounded-full` значки.
- Зона натискання ≥ 40px (`h-10` на полях і кнопках форм).

## 5. Компоненти й варіанти

Лише з `@/components/ui`. Нові компоненти — `npx shadcn@latest add <назва>`.

| Компонент | Варіанти | Правило |
|---|---|---|
| `Button` | `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` | `default` — одна основна дія на екран («Submit», «Approve»); `secondary` — «Add line», «Remove»; `outline` — дія поруч з основною («Make approver»); `destructive` — лише «Reject» |
| `Input` + `Label` | — | у кожного поля підпис (`Label` чи видимий текст у `<label>`, у рядку таблиці — `aria-label`); placeholder — не замість підпису |
| `Select` | нативний `<select>` з токенами | форма лишається звичайною HTML-формою (Server Action) |
| `Card` | з `title` чи без | одна тема на картку; картку в картку не вкладаємо |
| `Table` | — | рядки закупівлі; `aria-label`; числа праворуч, `tabular-nums` |
| `Badge` | `neutral`, `accent`, `danger`; `StatusBadge`, `RoleBadge` | статус — завжди з текстом; роль — англійська назва з таблиці PM, ідентифікатор у `data-role` |
| `Dialog` | — | лише підтвердження незворотної дії |
| `Alert` | `destructive` (помилка), `neutral` (відмова), `success` (успіх) | текст — дослівно з AC; помилка `role="alert"`, успіх `role="status"` |
| `EmptyState` | — | одне речення замість списку |

## 6. Стани

| Стан | Як виглядає | Приклад тексту |
|---|---|---|
| Порожній список | `EmptyState`: `text-muted-foreground` по центру в пунктирній рамці | «You have not submitted any requests yet», «No requests awaiting your decision» |
| Помилка дії | `Alert` `destructive` над кнопкою подання; введене лишається у формі | «Add at least one line», «Fill in all line fields», «Provide a reason» |
| Відмова в доступі | сторінка з нейтральним `Alert` і посиланням «Back to home», без даних | «Not enough permissions» |
| Завантаження | кнопка `disabled` під час подання (`useActionState` `pending`) | — |
| Успіх | `Alert` `success` над списком | «Purchase submitted» |
| Вимкнена дія | `disabled` (`opacity-50`, `cursor-not-allowed`) | — |

## 7. Доступність — мінімум

- Підпис у кожного поля; помилка форми — `role="alert"`.
- Видимий фокус: `ring` (2px) на кожному інтерактивному елементі; Tab проходить форму по порядку.
- Контраст — таблиця в розділі 2.
- Статус ніколи не лише кольором — поруч завжди текст.
- Спершу семантичний HTML (`<button>`, `<table>`, `<label>`); `aria-*` — там, де HTML бракує.
- Рух мінімальний; поважаємо `prefers-reduced-motion`.

## 8. Do / Don't

| ✅ Робимо | ❌ Не робимо |
|---|---|
| `bg-primary text-primary-foreground` | `bg-indigo-600 text-white`, `bg-[#4f46e5]`, `style={{ color: "#…" }}` |
| компонент `Button` з потрібним варіантом | власний `<button className="…">` у сторінці |
| `StatusBadge` з текстом статусу | кольорова крапка без тексту |
| відмова — нейтральний `Alert` | червоне повідомлення «Not enough permissions» |
| новий токен через розділ 9 | новий колір «лише для цієї сторінки» |
| тексти дослівно з таблиці PM | перефразовані повідомлення |

## 9. Як додати токен

1. Опишіть токен у таблиці розділу 2: для чого, значення в обох темах, контраст.
2. `src/app/globals.css`: `--<назва>` у `:root` і в `@media (prefers-color-scheme: dark)`.
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. Додайте токен в артефакт дизайн-системи (джерело вгорі), `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки `/login` і `/` у світлій і темній темі (`docs/img/ws7-before-*`, `docs/img/ws7-after-*`), Tab по формі, контраст.
