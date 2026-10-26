# Дизайн-система: School Purchasing

- **Джерело:** артефакт Claude Design (Design System) — https://claude.ai/artifact/HHx1LvhQe5MeYqef7joXb3 (приватний; знімок — в описі PR). Створено в Claude Code з «Вигляду й тону» PM; палітра — «Calm School» (теплий світлий фон, глибокий зелений бренд; темна тема — приглушені зелені), лого — герб школи.
- **Вхід від PM:** розділ «Вигляд і тон» у `requirements/product.md` (знімок 2026-10-25).
- **Код:** токени — `src/app/globals.css`; компоненти — `src/components/ui/` (shadcn/ui і обгортки застосунку в `src/components/ui/index.tsx`); перевірка — `npm run check:design`.

## 1. Огляд

Застосунок закупівель школи: працівник подає закупівлю у свій відділ, схвалювач вирішує, адміністратор налаштовує відділи й права. Користуються з комп'ютера й телефона. Тон — спокійний, діловий, уважний до людей; без жартів, окликів, яскравих градієнтів і дрібного сірого тексту. Щільність важливіша за простір у списках (схвалювач бачить багато рядків без прокручування), а форма проста: одне поле на рядок, великі зони натискання. Інтерфейс англійською; дані, які ввели люди, — як введено.

## 2. Кольори

Семантичні токени з іменами shadcn/ui, значення — OKLCH. У сторінках — лише утиліти з колонки «Клас», ніколи hex, `bg-[#…]` чи сирі палітри (`zinc-500`, `bg-white`). Темна тема — ті самі назви токенів. Тему обирає перемикач `ThemeToggle` (місяць / сонце) у шапці й на сторінці входу: атрибут `data-theme` на `<html>` і cookie `theme` на рік, тож сервер одразу віддає сторінку в обраній темі. Доки людина нічого не обрала, тема — за системою (`prefers-color-scheme`). Варіант Tailwind `dark:` діє за тією самою умовою (`@custom-variant dark` у `globals.css`).

| Токен | Для чого | Світла | Темна | Клас |
|---|---|---|---|---|
| `background` / `foreground` | тло сторінки й основний текст | `oklch(0.97 0.008 91.5)` / `oklch(0.312 0.019 157.2)` | `oklch(0.244 0.018 158.4)` / `oklch(0.957 0.012 116.8)` | `bg-background`, `text-foreground` |
| `card` / `card-foreground` | картки, форми, таблиці | `oklch(1 0 0)` / `oklch(0.312 0.019 157.2)` | `oklch(0.298 0.023 157.7)` / `oklch(0.957 0.012 116.8)` | `bg-card`, `text-card-foreground` |
| `popover` / `popover-foreground` | діалоги, випадні списки | `oklch(1 0 0)` / `oklch(0.312 0.019 157.2)` | `oklch(0.336 0.025 153.8)` / `oklch(0.957 0.012 116.8)` | `bg-popover`, `text-popover-foreground` |
| `primary` / `primary-foreground` | одна основна дія на екран («Submit», «Approve»), посилання | `oklch(0.381 0.055 162.7)` / `oklch(0.97 0.008 91.5)` | `oklch(0.787 0.057 138.6)` / `oklch(0.244 0.018 158.4)` | `bg-primary`, `text-primary-foreground`, `text-primary` |
| `secondary` / `secondary-foreground` | другорядна дія («Add line», «Remove»), значок ролі | `oklch(0.954 0.011 100.8)` / `oklch(0.312 0.019 157.2)` | `oklch(0.336 0.025 153.8)` / `oklch(0.957 0.012 116.8)` | `bg-secondary`, `text-secondary-foreground` |
| `muted` / `muted-foreground` | приглушене тло (відмова, заголовок таблиці), підписи й мета-текст | `oklch(0.954 0.011 100.8)` / `oklch(0.511 0.02 153.2)` | `oklch(0.336 0.025 153.8)` / `oklch(0.788 0.018 140)` | `bg-muted`, `text-muted-foreground` |
| `accent` / `accent-foreground` | наведення, вибраний рядок, повідомлення про успіх, значок адміністратора | `oklch(0.934 0.018 134.9)` / `oklch(0.381 0.055 162.7)` | `oklch(0.364 0.036 155.1)` / `oklch(0.873 0.041 137.2)` | `bg-accent`, `text-accent-foreground` |
| `destructive` / `destructive-foreground` | лише «Reject» і текст помилки введення | `oklch(0.501 0.178 28.7)` / `oklch(1 0 0)` | `oklch(0.796 0.092 27.6)` / `oklch(0.244 0.018 158.4)` | `bg-destructive`, `text-destructive` |
| `border` | декоративні межі карток, роздільники рядків | `oklch(0.909 0.014 97.5)` | `oklch(0.392 0.028 150.9)` | `border-border` |
| `input` | межа поля вводу й контурної кнопки | `oklch(0.62 0.016 155.4)` | `oklch(0.602 0.023 151.9)` | `border-input` |
| `ring` | кільце фокусу | `oklch(0.381 0.055 162.7)` | `oklch(0.787 0.057 138.6)` | `ring-ring`, `outline-ring` |
| `status-pending` / `status-pending-foreground` | статус «Awaiting approval» — теплий жовтий | `oklch(0.955 0.045 91.7)` / `oklch(0.489 0.093 82.3)` | `oklch(0.329 0.035 86.3)` / `oklch(0.88 0.099 89.8)` | `bg-status-pending`, `text-status-pending-foreground` |
| `status-approved` / `status-approved-foreground` | статус «Approved» — зелений | `oklch(0.933 0.029 140.5)` / `oklch(0.429 0.075 151.3)` | `oklch(0.343 0.049 152.2)` / `oklch(0.858 0.074 141.4)` | `bg-status-approved`, `text-status-approved-foreground` |
| `status-rejected` / `status-rejected-foreground` | статус «Rejected» — червоний | `oklch(0.927 0.026 29.4)` / `oklch(0.465 0.144 29.5)` | `oklch(0.317 0.054 29)` / `oklch(0.841 0.068 28.8)` | `bg-status-rejected`, `text-status-rejected-foreground` |
| `book-cover` | лише декоративна 3D-книга на сторінці входу (`OpenBook`): шкіряна палітурка | `oklch(0.43 0.07 52)` | `oklch(0.36 0.055 50)` | `bg-book-cover` |
| `book-paper` / `book-edge` / `book-ink` | там само: папір сторінок, зріз блоку сторінок, рядки «тексту» | `oklch(0.96 0.025 88)` / `oklch(0.84 0.045 80)` / `oklch(0.6 0.025 70)` | `oklch(0.84 0.03 86)` / `oklch(0.7 0.04 78)` / `oklch(0.52 0.025 70)` | `bg-book-paper`, `bg-book-edge` |

Палітра «Calm School»: основні кольори задала розробниця (hex — `background` `#F7F5EF` / `#19231D`, `card` `#FFFFFF` / `#243129`, `popover`·`muted` `#F1F0E8` / `#2D3B31`, `primary` `#244C3A` / `#A8C3A0`, `foreground` `#29342D` / `#F0F2E9`, `border` `#E3E1D7` / `#3B4A3E`); решту токенів підібрано в тих самих тонах і перевірено контрастом нижче.

Правила за змістом (з «Вигляду й тону» PM):

- `primary` — одна основна дія на екрані; той самий колір на всіх екранах.
- `destructive` — лише небезпечна або незворотна дія («Reject») і текст помилки введення; не для звичайних повідомлень.
- Відмова «Not enough permissions» — нейтральна (`bg-muted text-foreground`), не червона: людина нічого не зламала.
- Статус завжди має текст; колір лише підсилює.

### Контраст

Пораховано за WCAG 2 (OKLCH → sRGB) для кожної пари в обох темах.

| Пара | Світла | Темна | Норма |
|---|---|---|---|
| `foreground` на `background` | 11,9 | 14,3 | ≥ 4.5 |
| `foreground` на `card` | 12,9 | 12,0 | ≥ 4.5 |
| `muted-foreground` на `background` | 5,2 | 8,4 | ≥ 4.5 |
| `muted-foreground` на `card` | 5,7 | 7,0 | ≥ 4.5 |
| `muted-foreground` на `muted` | 5,0 | 6,1 | ≥ 4.5 |
| `primary-foreground` на `primary` | 8,9 | 8,4 | ≥ 4.5 |
| `primary` на `card` (посилання) | 9,7 | 7,1 | ≥ 4.5 |
| `secondary-foreground` на `secondary` | 11,3 | 10,4 | ≥ 4.5 |
| `accent-foreground` на `accent` | 8,0 | 7,2 | ≥ 4.5 |
| `destructive-foreground` на `destructive` | 6,5 | 8,2 | ≥ 4.5 |
| `destructive` на `card` | 6,5 | 6,9 | ≥ 4.5 |
| `status-pending-foreground` на `status-pending` | 5,6 | 8,6 | ≥ 4.5 |
| `status-approved-foreground` на `status-approved` | 6,5 | 7,6 | ≥ 4.5 |
| `status-rejected-foreground` на `status-rejected` | 6,0 | 7,8 | ≥ 4.5 |
| `input` на `card` | 3,6 | 3,5 | ≥ 3 |
| `input` на `background` | 3,3 | 4,2 | ≥ 3 |
| `ring` на `background` | 8,9 | 8,4 | ≥ 3 |
| `ring` на `card` | 9,7 | 7,1 | ≥ 3 |

Токени `book-*` — лише для декоративної книги (`aria-hidden`, без тексту й дій), тож норм контрасту для них немає; у компонентах застосунку їх не використовуємо.

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

### Лого

- Герб школи — `public/logo.png` (256×256), іконка вкладки — `src/app/icon.png`. Має власне темно-зелене тло, тож однаковий в обох темах.
- Лише через компонент `Logo` (`size`: 32 у шапці, 88 на сторінці входу); поруч завжди текст «School Purchasing», тому `alt=""`.
- Не перефарбовуємо, не обрізаємо до кола й не кладемо на `bg-primary`: герб і так темно-зелений.

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
| `ThemeToggle` | — | одна кнопка-іконка в шапці й на сторінці входу; `aria-label` «Switch light or dark theme» |
| `Logo` | `size` | герб школи з `public/logo.png`; лише поруч із назвою «School Purchasing» |

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
2. `src/app/globals.css`: `--<назва>` у `:root` і в обох блоках темної теми — `:root[data-theme="dark"]` і `@media (prefers-color-scheme: dark)` (значення однакові).
3. `--color-<назва>: var(--<назва>);` у `@theme inline` → з'являються класи `bg-<назва>`, `text-<назва>`, `border-<назва>`.
4. Додайте токен в артефакт дизайн-системи (джерело вгорі), `npm run check:design` і знімок сторінки у світлій і темній темі.

## 10. Перевірка

- `npm run check:design` — жодного hex, довільного кольору, сирої палітри чи кольору в inline style поза `src/components/ui` і `globals.css`. CI: `.github/workflows/architecture.yml`, job «Дизайн-система: лише токени».
- Виняток — коментар `design-ok: <причина>` у тому самому рядку; кожен виняток — з реальною причиною.
- Візуально: знімки `/login` і `/` у світлій і темній темі (`docs/img/ws7-before-*`, `docs/img/ws7-after-*`), Tab по формі, контраст.
