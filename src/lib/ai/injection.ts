// Перша лінія захисту від ін'єкції в описі покупки (AC-AI-06): вузькі шаблони в коді, ДО виклику моделі.
// Модель лишається другою лінією для формулювань поза списком (промпт: межа <description> і статус "injection").
// Навіщо в коді: безкоштовні моделі ланцюжка поводяться по-різному, і інша модель могла б пропустити спробу й повернути
// рядок; перевірка в коді спрацьовує щоразу однаково й не витрачає запит із денного ліміту.
// Шаблони свідомо вузькі: звичайний опис покупки (golden cases GC-01, GC-13, GC-14 тощо) не має їх зачіпати.
const PATTERNS: readonly RegExp[] = [
  /\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|earlier|all)\b.{0,30}\b(instructions?|prompts?|rules)\b/i,
  /\bsystem prompt\b/i,
  /\b(create|submit)\s+(a\s+)?(new\s+)?request\b/i,
  /\bpasswords?\b/i,
];

/** Чи схожий опис на спробу дати вказівки помічнику. NFKC і стиснуті пробіли — щоб не обійти шаблон «дивними» символами. */
export function looksLikeInjection(text: string): boolean {
  const normalized = text.normalize("NFKC").replace(/\s+/g, " ");
  return PATTERNS.some((pattern) => pattern.test(normalized));
}
