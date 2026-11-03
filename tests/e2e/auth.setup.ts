// Вхід кожної ролі один раз за прогін → playwright/.auth/<role>.json (у .gitignore: там живі cookie сесії).
// Тести ролей беруть стан через test.use({ storageState: "playwright/.auth/<role>.json" }).
// У цьому проєкті запис вимкнено (playwright.config.ts: setup — video, trace і screenshot "off"): тут вводиться пароль.
//
// Змінні з паролями (лише назви; значення — у .env.local локально або в secrets CI, ніколи в коді):
//   DEMO_USER_PASSWORD           — спільний пароль акаунтів із supabase/demo-users.json (npm run users:demo);
//   UAT_PASSWORD_<РОЛЬ>          — необов'язково: окремий пароль для ролі, напр. UAT_PASSWORD_ADMIN.
//
// Джерело: демо-репо курсу, tests/e2e/auth.setup.ts (тег ws8-03-uat). ROLES — ВАШІ: роль → адреса акаунта на проді
// (D0.5, *@example.test). School Purchasing: 3 AC WS8 (AC-APR-04, AC-FRM-06, AC-FRM-03) — лише роль requester.
import { expect, test as setup } from "@playwright/test";
import { signIn } from "./support/uat";

const ROLES = {
  requester: { email: "pm-requester@example.test", name: "PM Requester" },
} as const;

for (const [role, { email, name }] of Object.entries(ROLES)) {
  setup(`вхід: ${role}`, async ({ page }) => {
    const password = process.env[`UAT_PASSWORD_${role.toUpperCase()}`] ?? process.env.DEMO_USER_PASSWORD;
    expect(password, `немає пароля для ролі ${role}: DEMO_USER_PASSWORD або UAT_PASSWORD_${role.toUpperCase()}`).toBeTruthy();
    await signIn(page, email, password!);
    // Шапка показує меню акаунта з іменем того, хто увійшов (src/components/user-menu.tsx: aria-label «Account menu: …»).
    await expect(page.getByRole("button", { name: `Account menu: ${name}` })).toBeVisible();
    await page.context().storageState({ path: `playwright/.auth/${role}.json` });
  });
}
