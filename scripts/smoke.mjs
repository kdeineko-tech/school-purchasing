#!/usr/bin/env node
// Smoke розгорнутого застосунку: лише GET, без входу й форм (Node 24, без залежностей). D0 — прод; WS11 (v2) — ще й
// кожен непродовий деплой (preview з PR, гілка staging) за його власною адресою, з обходом захисту Vercel.
// Використання: node scripts/smoke.mjs <base-url> [expected-sha]     (або npm run smoke -- <base-url> [sha])
//   1) "/"           → 200 або редірект на /login того самого застосунку (не інший код і не стіна входу Vercel);
//   2) "/login"      → 200 і поле пароля (застосунок справді віддає сторінку);
//   3) "/api/health" → 200 {db:"ok"}; з expected-sha — sha збігається (до 6 спроб × 20 с: прод-домен перемикається
//                      на новий деплой не миттєво).
// Код виходу: 0 — усе гаразд, 1 — є збій (рядки ::error:: видно в GitHub Actions), 2 — не вказано адресу.
//
// WS11, v2 (шаблон курсу materials/ops-kit/scripts/smoke.mjs; власні доповнення D0 вище збережено):
//   - VERCEL_AUTOMATION_BYPASS_SECRET задано → кожен запит несе заголовок x-vercel-protection-bypass (Protection Bypass
//     for Automation). Значення ніколи не друкуємо: у журналі лише bypass=true/false. Без змінної — як у D0.
//   - x-vercel-set-bypass-cookie НЕ надсилаємо: Vercel відповів би редіректом із Set-Cookie, а redirect:"manual"
//     побачив би 3xx замість сторінки.
//   - SMOKE_TARGET=deploy (ставить job deploy у smoke.yml) змінює лише підказки в повідомленнях про збій.
//   - Секрет обходу йде лише туди, де він потрібен (знахідки CodeRabbit у #93): лише по https (http:// із секретом —
//     зупинка до першого запиту) і, якщо задано SMOKE_BYPASS_HOST_PATTERN (регулярний вираз хоста; ставить smoke.yml
//     для job deploy), лише на хост, що йому відповідає. Інший хост — без заголовка, з попередженням у журналі.
const [rawBase = process.env.PROD_URL ?? "", expectSha = ""] = process.argv.slice(2);
// client_payload.url від Vercel може прийти хостом без схеми — додаємо https://.
const base = (/^https?:\/\//.test(rawBase) ? rawBase : rawBase ? `https://${rawBase}` : "").replace(/\/+$/, "");
const secret = (process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
const target = process.env.SMOKE_TARGET === "deploy" ? "deploy" : "prod";

/** Чи можна надсилати секрет обходу на цю адресу: null — так; рядок — чому ні (без значення секрету). */
function bypassRefusal(baseUrl, hostPattern) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return "адреса не розбирається";
  }
  if (url.protocol !== "https:") return "секрет обходу надсилаємо лише через https://";
  if (hostPattern && !new RegExp(hostPattern).test(url.hostname)) {
    return `хост ${url.hostname} не відповідає SMOKE_BYPASS_HOST_PATTERN — це не деплой нашого проєкту Vercel`;
  }
  return null;
}

const refusal = secret && base ? bypassRefusal(base, process.env.SMOKE_BYPASS_HOST_PATTERN?.trim()) : null;
const bypass = secret && !refusal ? secret : "";
const headers = { "user-agent": "smoke/2.0 (WS11)" };
if (bypass) headers["x-vercel-protection-bypass"] = bypass;

const get = async (path) => {
  try {
    // Тайм-аут на запит і читання тіла: завислий прод дає status 0 і зрозумілу помилку, а не тайм-аут job.
    const r = await fetch(base + path, {
      redirect: "manual",
      headers,
      signal: AbortSignal.timeout(15_000),
    });
    return {
      status: r.status,
      location: r.headers.get("location") ?? "",
      vercelError: r.headers.get("x-vercel-error") ?? "",
      text: await r.text(),
    };
  } catch (e) {
    return { status: 0, location: "", vercelError: "", text: String(e.cause?.code ?? e) };
  }
};
const vercelWall = (r) =>
  /vercel\.com\/(sso|login)|_vercel_sso/.test(r.location) || ((r.status === 401 || r.status === 403) && /vercel/i.test(r.text));

// Підказка про стіну входу Vercel залежить від того, що перевіряємо і чи є секрет обходу.
function wallHint() {
  if (bypass) {
    return "Vercel не прийняв секрет обходу — його перегенерували чи видалили? Скопіюйте актуальний з Vercel (Settings → Deployment Protection → Protection Bypass for Automation) у GitHub Secrets VERCEL_AUTOMATION_BYPASS_SECRET і зробіть Redeploy";
  }
  if (target === "deploy") {
    return "деплой за захистом Vercel, а секрету обходу немає — увімкніть Protection Bypass for Automation (Vercel → Settings → Deployment Protection) і додайте значення в GitHub Secrets як VERCEL_AUTOMATION_BYPASS_SECRET";
  }
  return "прод за стіною входу Vercel — Settings → Deployment Protection: Standard Protection (захищає preview і staging, прод відкритий), не All Deployments";
}

// Редірект "/" дозволено лише на /login того самого застосунку (гість без сесії), не на інший шлях чи домен.
const isLoginRedirect = (location) => {
  try {
    const url = new URL(location, base);
    return url.origin === new URL(base).origin && url.pathname === "/login";
  } catch {
    return false;
  }
};

async function main() {
  const fail = [];
  const root = await get("/");
  if (vercelWall(root)) fail.push(`"/": ${wallHint()}`);
  else if (root.status === 0) fail.push(`"/": недоступний (${root.text})`);
  else if (root.status >= 300 && root.status < 400) {
    if (!isLoginRedirect(root.location)) {
      fail.push(`"/": HTTP ${root.status} → ${root.location || "(без Location)"} — очікували 200 або редірект на /login`);
    }
  } else if (root.status !== 200) {
    // 201/204 тощо теж збій: "/" має віддати сторінку, а не порожню відповідь.
    const hint = root.vercelError === "MIDDLEWARE_INVOCATION_FAILED" ? " — у Vercel бракує NEXT_PUBLIC_SUPABASE_*?" : "";
    fail.push(`"/": HTTP ${root.status} ${root.vercelError}${hint}`.trim());
  }

  const login = await get("/login");
  if (login.status !== 200 || !/type=["']?password/i.test(login.text)) {
    fail.push(`"/login": HTTP ${login.status} ${login.vercelError}${login.status === 200 ? " (немає поля пароля)" : ""}`.trim());
  }

  let health = null;
  for (let attempt = 1; attempt <= (expectSha ? 6 : 1) && login.status === 200; attempt++) {
    const r = await get("/api/health");
    try {
      health = { status: r.status, ...JSON.parse(r.text) };
    } catch {
      health = { status: r.status, location: r.location };
    }
    // sha=local чи sha немає взагалі — Vercel не віддає VERCEL_GIT_COMMIT_SHA або це не наш health: чекати марно.
    if (!expectSha || health.sha === expectSha || health.sha === "local" || !health.sha) break;
    if (attempt < 6) await new Promise((res) => setTimeout(res, 20_000));
  }
  if (!health) {
    // сторінка не відкрилась — причина вже у fail
  } else if (health.status === 404) {
    fail.push(`"/api/health": 404 — додайте src/app/api/health/route.ts`);
  } else if (health.status >= 300 && health.status < 400) {
    fail.push(`"/api/health": ${health.status} → ${health.location} — додайте "/api/health" у PUBLIC_PATHS (src/lib/supabase/proxy.ts)`);
  } else if (health.reason === "paused") {
    fail.push(`"/api/health": Supabase призупинено — Dashboard → Resume project (безкоштовний проєкт засинає після 7 днів без достатньої активності бази)`);
  } else if (health.reason === "invalid-api-key") {
    fail.push(`"/api/health": ключ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY у Vercel не приймається — звірте змінні цього середовища і зробіть Redeploy`);
  } else if (health.db !== "ok") {
    fail.push(
      `"/api/health": HTTP ${health.status}, db=${health.db ?? "?"}${health.reason ? ` (${health.reason})` : ""} — Supabase недоступний чи NEXT_PUBLIC_SUPABASE_URL у Vercel не той?`,
    );
  }
  if (expectSha && health?.sha === "local") {
    fail.push(`"/api/health": sha=local — у Vercel увімкніть Settings → Environment Variables → «Automatically expose System Environment Variables» і зробіть Redeploy`);
  } else if (expectSha && health && health.status === 200 && !health.sha) {
    // Без sha коміт не звірити — інакше smoke пройшов би для невідомого деплою (знахідка CodeRabbit у #93).
    fail.push(`"/api/health": немає sha — коміт деплою не можна звірити з ${expectSha.slice(0, 7)}`);
  } else if (expectSha && health?.sha && health.sha !== expectSha) {
    const why = target === "deploy" ? "адреса деплою показує інший коміт — чи та адреса в client_payload.url?" : "деплой main не пройшов чи зроблено Instant Rollback?";
    fail.push(`${base} показує ${String(health.sha).slice(0, 7)}, а очікувався ${expectSha.slice(0, 7)} — ${why}`);
  }

  // Лише статуси й відповідь /api/health (публічна, без секретів: тут видно appEnv і supabaseRef). Секрет — лише true/false.
  console.log(JSON.stringify({ base, target, bypass: Boolean(bypass), root: root.status, login: login.status, health }));
  for (const f of fail) console.log(`::error title=smoke ${base}::${f}`);
  if (!fail.length) console.log("OK — застосунок живий, сторінка входу відкривається, база відповідає.");
  return fail.length ? 1 : 0;
}

// process.exitCode, а не process.exit(): на Windows exit() після fetch падає з assertion libuv.
if (!base) {
  console.error("Використання: node scripts/smoke.mjs <base-url> [expected-sha]  (або змінна PROD_URL)");
  process.exitCode = 2;
} else if (refusal && base.startsWith("http://")) {
  // http:// із секретом — помилка налаштування: зупиняємось до першого запиту, щоб секрет не пішов відкритим текстом.
  console.log(`::error title=smoke ${base}::${refusal}. Вкажіть адресу з https://.`);
  process.exitCode = 1;
} else {
  if (refusal) console.log(`::warning title=smoke ${base}::Секрет обходу не надіслано: ${refusal}.`);
  process.exitCode = await main();
}
