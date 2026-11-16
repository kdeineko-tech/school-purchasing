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
  lineFields: "Fill in all line fields", // AC-FRM-15
  noRequests: "You have not submitted any requests yet", // AC-FRM-14
  purchaseSubmitted: "Purchase submitted", // AC-FRM-11
  provideReason: "Provide a reason", // AC-APR-06, AC-LANG-05
  noDecisionRequests: "No requests awaiting your decision", // список для рішення без заявок
  allLinesRejected: "All lines are rejected: reject the whole request", // захист даних при частковому схваленні
  // Не з тексту PM: застосунок уже новий, а міграцію часткового схвалення ще не застосовано (PGRST202) — кілька хвилин
  // між розгортанням і db-deploy.
  decisionUnavailable: "Could not save the decision. Try again in a few minutes",
  // Не з тексту PM: кількість чи ціна рядка, які база не приводить до числа (код INVALID_LINE); межі значень —
  // наступний зріз.
  invalidLine: "Check the quantity and price in each line",
  // Не з тексту PM: порожня чи задовга назва (власне припущення, docs/spec-reading.md; межа 100 — «Припущення» PM);
  // англійською в термінах таблиці #49.
  departmentNameInvalid: "Enter a department name of up to 100 characters",
  // Не з тексту PM: серверні ліміти (зауваження PM 5, kdeineko-tech/school-purchasing#70; чисел PM не задавав —
  // 500 символів, як поле причини у формі, і 100 рядків; міграція 20261113115937_server_limits.sql).
  tooManyLines: "A purchase can have at most 100 lines",
  lineTooLong: "Item and purpose must be at most 500 characters",
  reasonTooLong: "Reason must be at most 500 characters",
  // AI-пропозиція рядка (зріз 4, AC-AI-01 … AC-AI-06): тексти дослівно з таблиці ValiaBihun/2026-quitcode-dream-team#49.
  suggestLines: "Suggest lines",
  lookingForLines: "Looking for lines…",
  purchaseDescription: "Purchase description",
  aiOffTopic: "I can only help with purchases", // AC-AI-02
  aiNoSuggestion: "Could not get a suggestion. Fill in the lines manually", // AC-AI-04
  aiUnavailableToday: "The assistant is unavailable today. Fill in the lines manually", // AC-AI-05
  aiInjection: "I don't follow instructions from the description. Describe the purchase", // AC-AI-06
  // Межі кількості й ціни в пропозиції — «ті самі, що в формі» (відповідь PM на ValiaBihun/2026-quitcode-dream-team#78).
  quantityRange: "Quantity: a whole number from 1",
  priceRange: "Price: a number from 0",
} as const;
