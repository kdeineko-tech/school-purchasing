// Заміри серверних кроків сторінки: скільки тривають читання профілю й запити списків. Server Component не може
// поставити заголовок відповіді, тож заміри йдуть у журнал сервера — Vercel → Logs: рядки «[timing] …».
// Перевірка сесії в proxy має власний заголовок Server-Timing (src/lib/supabase/proxy.ts). У тестах не пишемо.
export async function timed<T>(label: string, work: () => Promise<T>): Promise<T> {
  const started = performance.now();
  try {
    return await work();
  } finally {
    if (process.env.NODE_ENV !== "test") {
      console.info(`[timing] ${label} ${Math.round(performance.now() - started)}ms`);
    }
  }
}
