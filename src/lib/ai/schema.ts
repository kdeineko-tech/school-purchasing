import { z } from "zod";

// Відповідь моделі для пропозиції рядка закупівлі (AC-AI-01, AC-AI-02, AC-AI-06; design.md impl-ai-line-suggestions, «AI»).
// Три стани:
//   ok        — у описі покупка: поля рядка (невідоме = null, нічого не вигадуємо — припущення PM, ValiaBihun/2026-quitcode-dream-team#79);
//   refused   — опис не про закупівлю або просить чужі дані (AC-AI-02, golden cases 8, 9);
//   injection — опис намагається керувати помічником (AC-AI-06, golden cases 11, 12).
// Кількість і ціну модель повертає такими, як у описі (зокрема 2.5, 0, −5): межі перевіряє код (src/lib/ai/suggest.ts),
// а не промпт. Кожне поле обов'язкове, «невідоме» = null (не .optional()): strict json_schema вимагає всі властивості.
export const LineSuggestionSchema = z.object({
  status: z.enum(["ok", "refused", "injection"]),
  name: z.string().max(200).nullable(),
  purpose: z.string().max(200).nullable(),
  quantity: z.number().nullable(),
  unitPrice: z.number().nullable(),
});

export type LineSuggestion = z.infer<typeof LineSuggestionSchema>;
