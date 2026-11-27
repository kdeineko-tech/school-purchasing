// D0: чи відповіла база на запит /api/health. Чиста функція — щоб перевірити всі гілки тестом без мережі.
// Запит — публічним ключем до таблиці без доступу для anon: «немає прав» (42501) теж означає, що Postgres живий.

/** Код SQLSTATE Postgres, напр. 42501 «permission denied»: запит дійшов до бази. */
const SQLSTATE = /^[0-9A-Z]{5}$/;
/** PostgREST не може під'єднатися до бази. */
const PGRST_DB_DOWN = /^PGRST00[0-3]$/;
/** PostgREST відхилив JWT ключа: 301 — недійсний чи прострочений, 303 — заявки JWT не пройшли перевірку. */
const PGRST_JWT_REJECTED = /^PGRST30[13]$/;
/** Supabase відповідає 540, коли безкоштовний проєкт призупинено (Dashboard → Resume project). */
const SUPABASE_PAUSED = 540;

export type DbProbe = { status: number; error: { code?: string; message?: string } | null };
export type DbHealth = { db: "ok" | "down"; reason: string };

export function classifyDbProbe({ status, error }: DbProbe): DbHealth {
  if (status === SUPABASE_PAUSED) return { db: "down", reason: "paused" };
  const code = error?.code ?? "";
  // 5xx (зокрема PGRST300 — зламана конфігурація JWT у PostgREST) — база для застосунку недоступна.
  if (status >= 500 || PGRST_JWT_REJECTED.test(code)) {
    return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
  }
  if (!error || SQLSTATE.test(code) || (code.startsWith("PGRST") && !PGRST_DB_DOWN.test(code))) {
    return { db: "ok", reason: "" };
  }
  if (/api key/i.test(error.message ?? "")) return { db: "down", reason: "invalid-api-key" };
  // 0 — мережа (Supabase недоступний або хибний URL), 5xx, PGRST000–003.
  return { db: "down", reason: `status-${status}${code ? `-${code}` : ""}` };
}

// WS11, staging: /api/health показує, яке це середовище і в яку базу дивиться збірка.
// На Vercel гілка staging — теж VERCEL_ENV=preview, тому середовище — з власної змінної APP_ENV (лише сервер, не
// NEXT_PUBLIC_). Ref проєкту Supabase — перший сегмент хоста публічної адреси бази (він і так є в браузері, не секрет).

/** Ref проєкту Supabase з адреси `https://<ref>.supabase.co`; інша адреса (локальна, кастомний домен) чи її немає — null. */
export function supabaseRefFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(hostname);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/** Значення APP_ENV як є (без пробілів по краях); не задано чи порожнє — null. */
export function appEnvFrom(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
