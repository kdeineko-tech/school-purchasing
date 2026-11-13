# QA proof pack: зріз 3 — часткове схвалення, повернення й повторне подання, номер, суми й історія заявки

<!--
Шаблон з koldovsky/2026-quitcode-09-software-factory-hw/materials/templates/proof-pack.template.md.
Proof pack WS8 — docs/qa/proof-pack-ws8.md. Посилання — на коміт e860116 (main після UAT WS9, PR #70), на PR і прогони.
Жодних паролів і пароля від accounts.zip. Акаунти — лише адреси *@example.test.
-->

- Прод-URL: https://school-purchasing-lemon.vercel.app
- Зріз 3: схвалювач частково схвалює чи повертає заявку, автор виправляє й подає знову; кожна заявка має номер, суми
  й історію рішень (roadmap «Продукту», рядок WS9; 9 AC після скорочення 05.11).
- Вимоги: https://github.com/ValiaBihun/2026-quitcode-dream-team · джерело: issues · знімок 2026-11-09
- Спека: https://github.com/kdeineko-tech/school-purchasing/blob/e860116/openspec/specs/purchase-history/spec.md,
  https://github.com/kdeineko-tech/school-purchasing/blob/e860116/openspec/specs/revision-decisions/spec.md,
  https://github.com/kdeineko-tech/school-purchasing/blob/e860116/openspec/specs/english-interface/spec.md (AC-LANG-09)
- `/api/health` на момент UAT: sha `a5c725e`, env production, db ok, 12.11.2026 10:47 (Київ)

## Доказ на кожен AC зрізу 3

Тести — на коміті `e860116`. «Здатен упасти»: червоний прогін CI на коміті лише з тестами (до реалізації) і SQL-мутанти
`npm run mutation:sql` (`scripts/mutants.mjs`, остаточно 10/10 KILLED у #69). Звіт UAT —
[`docs/qa/uat/2026-11-12/report.md`](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/report.md).

| AC | Вид | Тест (рівень, посилання) | Здатен упасти | Специфікація UAT | Вердикт UAT і кадр | PR і SHA злиття |
|---|---|---|---|---|---|---|
| AC-HIST-01 | основний сценарій (номер) | база: [numbers.test.ts#L38](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/numbers.test.ts#L38); домен і сторінка: [numbers.test.ts#L167](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/numbers.test.ts#L167) | SQL-мутант H1 (`last_number + 2`) — KILLED тестами AC-HIST-01, [#65](https://github.com/kdeineko-tech/school-purchasing/pull/65) | [numbers.spec.ts#L35](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/numbers.spec.ts#L35) | PASS (R6), [кадр](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-HIST-01-then-1.png) | [#65](https://github.com/kdeineko-tech/school-purchasing/pull/65), `1718db3` |
| AC-HIST-02 | основний сценарій (розрахунок) | unit: [numbers.test.ts#L128](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/numbers.test.ts#L128); сторінка: [numbers.test.ts#L196](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/numbers.test.ts#L196) | Stryker `src/lib/purchases/amounts.ts` — 100 %, [#65](https://github.com/kdeineko-tech/school-purchasing/pull/65) | [numbers.spec.ts#L76](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/numbers.spec.ts#L76) | PASS (R6), [кадр](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-HIST-02-then-1.png) | [#65](https://github.com/kdeineko-tech/school-purchasing/pull/65), `1718db3` |
| AC-HIST-06 | основний сценарій (історія) | база: [history.test.ts#L67](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/history.test.ts#L67); unit: [history.test.ts#L8](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/history.test.ts#L8); сторінка: [purchase-page.test.ts#L293](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/purchase-page.test.ts#L293) | червоний CI на `71847a5` (лише тести) — [run 42651649578](https://github.com/kdeineko-tech/school-purchasing/actions/runs/42651649578); SQL-мутант H1 (без запису в `submit_purchase`) — KILLED; Stryker `history.ts` — 100 % | [history.spec.ts#L62](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/history.spec.ts#L62) | **NEEDS-HUMAN** (R3), [кадр](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-HIST-06-then-1.png) — перевірки пройшли; рецензент не прийняв відділ «UAT» замість «Початкової школи» | [#67](https://github.com/kdeineko-tech/school-purchasing/pull/67), `6c10317` |
| AC-HIST-10 | відмова (чужі дані) | база: [history.test.ts#L100](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/history.test.ts#L100); сторінка: [purchase-page.test.ts#L315](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/purchase-page.test.ts#L315) | червоний CI на `71847a5` — [run 42651649578](https://github.com/kdeineko-tech/school-purchasing/actions/runs/42651649578); SQL-мутанти H2 (політика `using (true)`) і H3 (функція без перевірки видимості) — KILLED, [#67](https://github.com/kdeineko-tech/school-purchasing/pull/67) | [history.spec.ts#L96](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/history.spec.ts#L96) | PASS (R6), [кадр](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-HIST-10-then-1.png) | [#67](https://github.com/kdeineko-tech/school-purchasing/pull/67), `6c10317` |
| AC-DEC-01 | основний сценарій (рішення) | база: [partial-approval.test.ts#L75](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/partial-approval.test.ts#L75); дія: [partial-approval.test.ts#L150](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/partial-approval.test.ts#L150); сторінка: [partial-approval.test.ts#L189](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/partial-approval.test.ts#L189) | червоний CI на `db71f68` (лише тести) — [run 42673129028](https://github.com/kdeineko-tech/school-purchasing/actions/runs/42673129028); SQL-мутанти D1 (рядок не стає `rejected`) і D2 (`partially_approved` → `approved`) — KILLED; Stryker `decisions.ts` — 100 % | [partial-approval.spec.ts#L45](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/partial-approval.spec.ts#L45) | PASS (R6), [кадр](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-DEC-01-then-1.png) | [#68](https://github.com/kdeineko-tech/school-purchasing/pull/68), `c1e8942` |
| AC-DEC-04 | основний сценарій (рішення) | база: [return-for-revision.test.ts#L91](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/return-for-revision.test.ts#L91); дія: [return-for-revision.test.ts#L154](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/return-for-revision.test.ts#L154); сторінка: [return-for-revision.test.ts#L236](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/return-for-revision.test.ts#L236) | червоний CI на `d4bfd86` (лише тести) — [run 43061134000](https://github.com/kdeineko-tech/school-purchasing/actions/runs/43061134000) | [return-for-revision.spec.ts#L89](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/return-for-revision.spec.ts#L89) | PASS (R6), [кадр 1](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-DEC-04-then-1.png), [кадр 2](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-DEC-04-then-2.png) | [#69](https://github.com/kdeineko-tech/school-purchasing/pull/69), `a5c725e` |
| AC-DEC-06 | стан інтерфейсу (помилка) | база: [return-for-revision.test.ts#L116](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/return-for-revision.test.ts#L116); дія: [return-for-revision.test.ts#L163](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/return-for-revision.test.ts#L163) | червоний CI на `d4bfd86` — [run 43061134000](https://github.com/kdeineko-tech/school-purchasing/actions/runs/43061134000); SQL-мутант R1 (`return` без `REASON_REQUIRED`) — KILLED тестом AC-DEC-06; Stryker `decisions.ts` — 100 % | [return-for-revision.spec.ts#L56](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/return-for-revision.spec.ts#L56) | PASS (R6), [кадр](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-DEC-06-then-1.png) | [#69](https://github.com/kdeineko-tech/school-purchasing/pull/69), `a5c725e` |
| AC-DEC-07 | основний сценарій і відмова (лише автор) | база: [return-for-revision.test.ts#L152](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/return-for-revision.test.ts#L152), відмова не автору: [#L191](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/return-for-revision.test.ts#L191); дія: [return-for-revision.test.ts#L184](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/return-for-revision.test.ts#L184) | червоний CI на `d4bfd86` — [run 43061134000](https://github.com/kdeineko-tech/school-purchasing/actions/runs/43061134000); SQL-мутант R2 (подає знову не лише автор) — KILLED; Stryker `validateLines` — 100 % | [return-for-revision.spec.ts#L142](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/return-for-revision.spec.ts#L142) | PASS (R6), [кадр 1](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-DEC-07-then-1.png), [кадр 2](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-DEC-07-then-2.png) | [#69](https://github.com/kdeineko-tech/school-purchasing/pull/69), `a5c725e` |
| AC-LANG-09 | мова інтерфейсу (підпис статусу) | сторінка й список: [purchase-page.test.ts#L155](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/purchase-page.test.ts#L155), [#L165](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/purchases/purchase-page.test.ts#L165) | червоний CI на `d4bfd86` (`STATUS_LABELS.returned` немає) — [run 43061134000](https://github.com/kdeineko-tech/school-purchasing/actions/runs/43061134000) | [status-labels.spec.ts#L48](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/status-labels.spec.ts#L48) | PASS (R6), [кадр 1](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-LANG-09-then-1.png), [2](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-LANG-09-then-2.png), [3](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/frames/AC-LANG-09-then-3.png) | [#68](https://github.com/kdeineko-tech/school-purchasing/pull/68) `c1e8942` (тести), [#69](https://github.com/kdeineko-tech/school-purchasing/pull/69) `a5c725e`, специфікація UAT — [#70](https://github.com/kdeineko-tech/school-purchasing/pull/70) `e860116` |

Для AC-HIST-01 і AC-HIST-02 червоного прогону CI немає: тести й реалізацію задачі 1 запушено разом
([#65](https://github.com/kdeineko-tech/school-purchasing/pull/65)). Що тести здатні впасти, там доводять SQL-мутант H1
і Stryker.

## Не перевірено

| AC чи частина | Чому не перевірено | Що зроблено замість | Ризик на проді |
|---|---|---|---|
| AC-LANG-09 «в історії» | у WS9 записів історії про рішення немає; PM переніс цю частину в зріз, де вони з'являться (ValiaBihun/2026-quitcode-dream-team#75) | статус перевірено в списку й на сторінці заявки (тести, UAT) | немає: в історії зараз лише записи «Submitted» |
| AC-HIST-01 «PUR-1» і «PUR-2» буквально на проді | на проді вже є заявки, лічильник не з нуля; PM прийняв перевірку «номери підряд» (ValiaBihun/2026-quitcode-dream-team#73) | «PUR-1» і «PUR-2» на порожній базі — [тест бази](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/numbers.test.ts#L38); на проді — PUR-24 і PUR-25 підряд | низький |
| «Дано» з відділом «Початкова школа» (AC-HIST-06, AC-DEC-01, -04, -06) і Марія чи Петро як справжні схвалювачі | UAT на проді пише лише від синтетичних `uat-…@example.test` у своєму відділі «UAT»; справжній відділ PM не чіпаємо | той самий сценарій у тестах бази з «Primary School»; на проді — відділ «UAT» | низький: правила не залежать від назви відділу |
| AC-HIST-10 «історії не показано, а статус заявки не змінився» на кадрі | на сторінці відмови немає що показати: кадр доводить лише «Not enough permissions»; «історії не показано» і «статус не змінився» доводять приховані твердження (немає блоку «History» і записів у розмітці; статус у базі до й після той самий) — зауваження PM | [тест бази](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/db/history.test.ts#L100) і твердження UAT [history.spec.ts#L96](https://github.com/kdeineko-tech/school-purchasing/blob/e860116/tests/e2e/history.spec.ts#L96); PM перевірила в браузері 12.11 | низький |

FAIL немає. NEEDS-HUMAN — AC-HIST-06, у таблиці вище; PM прийняла його з оцінкою 3 ([коментар](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459)).

**Відомий залишок UAT на проді.** Синтетичні користувачі й їхні заявки видаляються після прогону (лишилось 0), але
відділи «UAT» і «UAT-2» лишаються: їх перевикористовує кожен наступний прогін. Номери заявок прогонів (PUR-22…PUR-30)
витрачено назавжди: лічильник не повертає номери видалених заявок (AC-HIST-01, «номер не повторюється»).

## A. Вимоги й спека

- `/requirements-sync` — PR «Оновлення вимог»: [#44](https://github.com/kdeineko-tech/school-purchasing/pull/44) (знімок 2026-11-02); після відповідей PM — [#47](https://github.com/kdeineko-tech/school-purchasing/pull/47), [#62](https://github.com/kdeineko-tech/school-purchasing/pull/62) (скорочення до 9 AC), [#66](https://github.com/kdeineko-tech/school-purchasing/pull/66) (знімок 2026-11-09)
- Спека `add-decision-history` і план — PR «Специфікація»: [#45](https://github.com/kdeineko-tech/school-purchasing/pull/45), [#46](https://github.com/kdeineko-tech/school-purchasing/pull/46)
- Зміни після уточнень: [#51](https://github.com/kdeineko-tech/school-purchasing/pull/51), [#52](https://github.com/kdeineko-tech/school-purchasing/pull/52) (відповіді PM), [#63](https://github.com/kdeineko-tech/school-purchasing/pull/63), [#64](https://github.com/kdeineko-tech/school-purchasing/pull/64) (9 AC)
- Питання PM: ValiaBihun/2026-quitcode-dream-team#65, #66, #67, #68, #69, #73, #74, #75 (усі закрито з відповіддю)

## B. Реалізація

| PR «Реалізація» | Задача з `tasks.md` | AC | Відповіді на знахідки CodeRabbit | `db-deploy` |
|---|---|---|---|---|
| [#65](https://github.com/kdeineko-tech/school-purchasing/pull/65) | 1. Номер і суми | AC-HIST-01, AC-HIST-02 | усі: виправлено / аргумент у треді | [run 42633442251](https://github.com/kdeineko-tech/school-purchasing/actions/runs/42633442251) |
| [#67](https://github.com/kdeineko-tech/school-purchasing/pull/67) | 2. Історія: запис «Подано» | AC-HIST-06, AC-HIST-10 | усі: виправлено / аргумент у треді | [run 42661371858](https://github.com/kdeineko-tech/school-purchasing/actions/runs/42661371858) |
| [#68](https://github.com/kdeineko-tech/school-purchasing/pull/68) | 3. Часткове схвалення | AC-DEC-01, AC-LANG-09 (тести) | усі: виправлено / аргумент у треді | [run 43051066113](https://github.com/kdeineko-tech/school-purchasing/actions/runs/43051066113) |
| [#69](https://github.com/kdeineko-tech/school-purchasing/pull/69) | 4. Повернення й повторне подання | AC-DEC-04, AC-DEC-06, AC-DEC-07, AC-LANG-09 | усі: виправлено / аргумент у треді | [run 43086890907](https://github.com/kdeineko-tech/school-purchasing/actions/runs/43086890907) |

- Ворота на `main` (`quality`): [run 43188752464](https://github.com/kdeineko-tech/school-purchasing/actions/runs/43188752464) (`e860116`)
- Мутації: SQL — `npm run mutation:sql`: 4/4 (#65) → 6/6 (#67) → 8/8 (#68) → 10/10 KILLED (#69); мутанти переносяться на
  найновішу міграцію, що перевизначає функцію. Stryker на змінених модулях — 100 %: `amounts.ts` (#65), `history.ts`
  (#67), `decisions.ts` (#68, #69), `validateLines` у `form.ts` (#69).

## C. UAT на проді

- Звіт: https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/qa/uat/2026-11-12/report.md — 9 AC: 8 PASS, 1 NEEDS-HUMAN, 0 FAIL
- Відео: вкладення в описі [#70](https://github.com/kdeineko-tech/school-purchasing/pull/70)
- Рецензент: `claude-haiku-5-5`, суперечки — `claude-sonnet-5-5`; $1,32 за прогін (ціни API)
- Перший прогін того ж дня (тести `14c006c`): 6 PASS, 3 NEEDS-HUMAN — слабкі кадри в AC-DEC-04 і AC-DEC-07, виправлено в `e55d6ae`; розбір в описі [#70](https://github.com/kdeineko-tech/school-purchasing/pull/70)
- Негативний контроль: NC-1 (`npm run uat:nc`, 12.11.2026 10:44) — AC-APR-04 з навмисно хибним текстом повідомлення; перевірка впала, Haiku сказав PASS, підсумок **FAIL** (R1), [#70](https://github.com/kdeineko-tech/school-purchasing/pull/70)
- Дані: `@writes` — 9 синтетичних `uat-261112084709-…@example.test`; прибирання: видалено 9, лишилось 0, їхніх рядків — 0

### Приймання PM

Приймання PM (@ValiaBihun, 12.11.2026): усі 9 AC — ✅, оцінка 3; відхилень немає, issue «Відхилення від вимог» не
відкривались. AC-HIST-06, AC-HIST-10 і AC-DEC-06 PM перевірила в браузері на проді, решту — за кадрами звіту й кодом.

| AC | Рішення PM | Посилання |
|---|---|---|
| AC-HIST-01 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-HIST-02 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-HIST-06 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-HIST-10 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-DEC-01 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-DEC-04 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-DEC-06 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-DEC-07 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |
| AC-LANG-09 | ✅ оцінка 3 | [коментар PM](https://github.com/kdeineko-tech/school-purchasing/pull/70#issuecomment-6827375459) |

## D. Прод і ретро

- `/api/health` після злиття всіх задач: sha `e860116`, env production, db ok, 12.11.2026
- Нові ролі й акаунти: зріз 3 нових ролей не додає — заявник, схвалювач відділу й адміністратор ті самі, що в зрізі 2
  (`pm-requester@example.test`, `pm-approver@example.test`, `pm-admin@example.test`); `accounts.zip` без змін —
  https://github.com/kdeineko-tech/school-purchasing/blob/e860116/accounts.zip ([#50](https://github.com/kdeineko-tech/school-purchasing/pull/50))
- `docs/conformance.md`: https://github.com/kdeineko-tech/school-purchasing/blob/e860116/docs/conformance.md — 9 AC зрізу 3 «реалізовано»; `npm run ac:coverage` OK

### Ретро

[`docs/qa/retro-ws9.md`](retro-ws9.md) — що б ми взяли з фабрики у свій звичайний процес.
