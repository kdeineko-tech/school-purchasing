// Запобіжник UAT на розгорнутій адресі (WS11, staging з окремою базою).
// Синтетичні дані UAT пишуться секретним ключем у базу з .env.local (tests/e2e/support/admin.ts), а застосунок на
// цільовій адресі читає СВОЮ базу. Якщо це різні проєкти Supabase (напр. --url прод, а в .env.local — staging),
// тести писали б не туди, куди дивиться застосунок, а прибирання — не там. Тому перед першим записом звіряємо ref
// бази з /api/health цільової адреси з ref з NEXT_PUBLIC_SUPABASE_URL у .env.local і зупиняємось при розбіжності.
// Playwright запускає це як globalSetup (playwright.config.ts) — і з npm run uat, і з `npx playwright test`.
// Значень ключів і паролів не друкуємо: лише ref проєктів (вони не секрет — є в NEXT_PUBLIC_SUPABASE_URL).

/**
 * Ref проєкту з https://<ref>.supabase.co, інакше null (та сама логіка, що supabaseRefFromUrl у src/lib/health.ts).
 * @param {string | undefined} url
 * @returns {string | null}
 */
export function supabaseRef(url) {
  if (!url) return null;
  try {
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(new URL(url).hostname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Заголовки обходу Vercel Deployment Protection — лише коли VERCEL_AUTOMATION_BYPASS_SECRET задано.
 * x-vercel-set-bypass-cookie: браузер отримує cookie обходу, тож і переходи сторінками проходять захист.
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string>}
 */
export function bypassHeaders(env = process.env) {
  const secret = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  return secret ? { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" } : {};
}

/**
 * Рішення запобіжника: null — можна писати; рядок — причина зупинки (без значень секретів).
 * @param {{ health: any, localUrl: string | undefined }} input
 * @returns {string | null}
 */
export function targetMismatch({ health, localUrl }) {
  const localRef = supabaseRef(localUrl);
  if (!localRef) return "NEXT_PUBLIC_SUPABASE_URL у .env.local не задано або це не адреса https://<ref>.supabase.co";
  const remoteRef = health && typeof health === "object" ? health.supabaseRef : undefined;
  if (typeof remoteRef !== "string" || !remoteRef) {
    return "цільова адреса не повідомляє supabaseRef у /api/health (старий деплой чи не той застосунок?)";
  }
  if (remoteRef !== localRef) {
    return `застосунок на цільовій адресі дивиться в проєкт ${remoteRef}, а .env.local — у ${localRef}`;
  }
  return null;
}

/** Playwright globalSetup: перевіряє лише розгорнуту адресу і лише коли прогін може писати (є секретний ключ). */
export default async function globalSetup() {
  const base = process.env.UAT_BASE_URL?.replace(/\/+$/, "");
  if (!base || !process.env.SUPABASE_SECRET_KEY) return;
  let health;
  try {
    const res = await fetch(`${base}/api/health`, { headers: bypassHeaders(), redirect: "manual" });
    health = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  } catch {
    health = null;
  }
  const reason = targetMismatch({ health, localUrl: process.env.NEXT_PUBLIC_SUPABASE_URL });
  if (reason) {
    throw new Error(
      `UAT зупинено до першого запису: ${reason}. Візьміть у .env.local ключі тієї бази, у яку дивиться ${base}, ` +
        "або запустіть лише AC, що нічого не пишуть (--grep-invert '@writes', без SUPABASE_SECRET_KEY).",
    );
  }
  console.log(`UAT: база цільової адреси і .env.local — той самий проєкт ${supabaseRef(process.env.NEXT_PUBLIC_SUPABASE_URL)}`);
}
