// Тексти повідомлень дослівно з вимог PM (requirements/): англійською за таблицею вимоги
// ValiaBihun/2026-quitcode-dream-team#49 (AC-LANG-01, AC-LANG-03). Тести й сторінки беруть їх лише звідси.
export const MESSAGES = {
  forbidden: "Not enough permissions", // AC-ORG-09
  departmentExists: "A department with this name already exists", // AC-ORG-34
  addAsRequesterFirst: "Add the employee to the department as a requester first", // AC-ORG-02, AC-ORG-33
  noApprover: "No approver", // AC-ORG-14
  deactivated: "Account deactivated. Contact your administrator", // AC-ORG-12
  lastAdmin: "At least one active administrator must remain", // AC-ORG-10, AC-ORG-18
  noDepartments: "You have not been added to any department. Contact your administrator.", // AC-FRM-05
  noLines: "Add at least one line", // AC-FRM-06, AC-LANG-04
  purchaseSubmitted: "Purchase submitted", // AC-FRM-11
  // Не з тексту PM: кількість чи ціна рядка, які база не приводить до числа (код INVALID_LINE); межі значень —
  // наступний зріз.
  invalidLine: "Check the quantity and price in each line",
  // Не з тексту PM: порожня чи задовга назва (власне припущення, docs/spec-reading.md; межа 100 — «Припущення» PM);
  // англійською в термінах таблиці #49.
  departmentNameInvalid: "Enter a department name of up to 100 characters",
} as const;
