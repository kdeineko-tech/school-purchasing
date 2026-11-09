// UAT WS9, задача 2 «Історія: запис «Подано»»: AC-HIST-06 (запис «Подано») і AC-HIST-10 (схвалювач чужого відділу).
// Обидва AC пишуть дані (@writes): одноразові uat-<прогін>-…@example.test — заявник відділу «UAT» і «Петро», схвалювач
// лише «UAT-2» (замість «Офісу»); afterAll видаляє обох разом із заявками й історією (OWNED_ROWS у support/admin.ts,
// записи історії — каскадом). Прогони — лише по одному: deleteUatUsers() прибирає всі uat-*.
// Інтерфейс англійською (ValiaBihun/2026-quitcode-dream-team#49): «Подано» — «Submitted», «Історія» — «History»,
// «Недостатньо прав» — «Not enough permissions». Формат запису — відповідь PM #74:
// «Submitted · <ім'я> · dd.mm.yyyy, HH:MM» за America/New_York.
import { expect, test } from "@playwright/test";
import { adminClient, createUatRequester, deleteUatUsers } from "./support/admin";
import { openNewestRequest, PAPER, submitPurchase } from "./support/purchases";
import { attachRuntimeErrors, given, signIn, thenStep, when } from "./support/uat";

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

const REQUESTER_NAME = "UAT History Requester";
let requester: { email: string; password: string } | undefined;
let petro: { email: string; password: string } | undefined;

// Незалежний від застосунку оракул формату: дата й час за America/New_York, 24-годинний.
function newYorkTime(iso: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/New_York",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.day}.${parts.month}.${parts.year}, ${parts.hour}:${parts.minute}`;
}

async function purchaseState(id: string) {
  const { data, error } = await adminClient().from("purchases").select("status, created_at").eq("id", id).single();
  if (error) throw error;
  return data as { status: string; created_at: string };
}

// Без SUPABASE_SECRET_KEY (.env.local) adminClient() падає з поясненням: такий прогін — лише з --grep-invert '@writes'.
test.beforeAll(async () => {
  requester = await createUatRequester("history", REQUESTER_NAME, "UAT");
  petro = await createUatRequester("petro", "UAT Petro", "UAT-2", { approves: true });
});

test.afterEach(async ({ page }) => attachRuntimeErrors(page));

test.afterAll(async () => {
  for (const user of [requester, petro]) {
    if (!user) continue;
    const result = await deleteUatUsers(user.email);
    expect(result.remaining, "лишився синтетичний користувач").toEqual([]);
    expect(result.leftoverRequests, "лишились заявки синтетичного користувача").toBe(0);
  }
});

test(
  "AC-HIST-06: працівник 1 подав закупівлю й відкриває історію цієї заявки — запис «Submitted» з його іменем, датою й часом",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-06" } },
  async ({ page }) => {
    await given("працівник 1 подав закупівлю у відділ «UAT» (замість «Початкової школи»)", async () => {
      await signIn(page, requester!.email, requester!.password);
      await submitPurchase(page, [PAPER]);
    });

    let id = "";
    await when("він відкриває історію цієї заявки", async () => {
      id = await openNewestRequest(page);
      await page.getByText("History", { exact: true }).scrollIntoViewIfNeeded();
    });

    const { created_at } = await purchaseState(id);
    const expected = `Submitted · ${REQUESTER_NAME} · ${newYorkTime(created_at)}`;
    await thenStep(
      page,
      {
        clause: "в історії є запис «Подано» з його іменем і датою та часом за часом `America/New_York`",
        visible: [`у блоці «History» запис «${expected}»`],
        hidden: [
          `дата й час — це час подання заявки в базі (${created_at}), переведений у America/New_York`,
          "запис рівно один",
        ],
      },
      async () => {
        await expect(page.getByTestId("history-entry")).toHaveText([expected]);
      },
    );
  },
);

test(
  "AC-HIST-10: Петро схвалює лише інший відділ і відкриває історію заявки за прямим посиланням — «Not enough permissions», історії немає, статус той самий",
  { tag: ["@uat", "@writes"], annotation: { type: "ac", description: "AC-HIST-10" } },
  async ({ page }) => {
    let id = "";
    let before = "";
    await given(
      "Петро схвалює лише відділ «UAT-2» (замість «Офісу»), заявка відділу «UAT» (замість «Початкової школи») з історією",
      async () => {
        await signIn(page, requester!.email, requester!.password);
        await submitPurchase(page, [PAPER]);
        id = await openNewestRequest(page);
        await expect(page.getByTestId("history-entry")).toHaveCount(1);
        before = (await purchaseState(id)).status;
        await page.context().clearCookies();
        await signIn(page, petro!.email, petro!.password);
      },
    );

    await when("Петро відкриває історію цієї заявки за прямим посиланням", async () => {
      await page.goto(`/purchases/${id}`);
    });

    await thenStep(
      page,
      {
        clause: "він бачить повідомлення «Недостатньо прав»",
        visible: ["повідомлення «Not enough permissions» (англійський текст PM для «Недостатньо прав»)"],
        hidden: [
          "історії не показано: блоку «History» і записів «Submitted» немає в розмітці сторінки",
          "статус заявки не змінився: статус у базі до й після відкриття той самий",
        ],
      },
      async () => {
        await expect(page.getByRole("main").getByRole("alert")).toHaveText("Not enough permissions");
        await expect(page.getByText("History", { exact: true })).toHaveCount(0);
        await expect(page.getByTestId("history-entry")).toHaveCount(0);
        await expect(page.getByText("Paper A4")).toHaveCount(0);
        expect((await purchaseState(id)).status).toBe(before);
      },
    );
  },
);
