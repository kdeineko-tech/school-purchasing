// Тексти повідомлень дослівно з вимог PM (requirements/): тести й сторінки беруть їх лише звідси.
export const MESSAGES = {
  forbidden: "Недостатньо прав", // AC-ORG-09
  departmentExists: "Відділ з такою назвою вже є", // AC-ORG-34
  // Не з тексту PM: порожня чи задовга назва (власне припущення, docs/spec-reading.md; межа 100 — «Припущення» PM).
  departmentNameInvalid: "Вкажіть назву відділу до 100 символів",
} as const;
