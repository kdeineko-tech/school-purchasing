// Тексти повідомлень дослівно з вимог PM (requirements/): тести й сторінки беруть їх лише звідси.
export const MESSAGES = {
  forbidden: "Недостатньо прав", // AC-ORG-09
  departmentExists: "Відділ з такою назвою вже є", // AC-ORG-34
  addAsRequesterFirst: "Спершу додайте працівника до відділу як заявника", // AC-ORG-02, AC-ORG-33
  noApprover: "Немає схвалювача", // AC-ORG-14
  deactivated: "Обліковий запис деактивовано. Зверніться до адміністратора", // AC-ORG-12
  lastAdmin: "Має лишитись хоча б один активний адміністратор", // AC-ORG-10, AC-ORG-18
  // Не з тексту PM: порожня чи задовга назва (власне припущення, docs/spec-reading.md; межа 100 — «Припущення» PM).
  departmentNameInvalid: "Вкажіть назву відділу до 100 символів",
} as const;
