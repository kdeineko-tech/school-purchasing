import { defineConfig, mergeConfig } from "vitest/config";
// «.mjs», а не «.mts» — як у vitest.coverage.config.mts (інакше npm run typecheck і next build падають на TS5097).
import base from "./vitest.config.mjs";

// Stryker мутує лише TS. Тести бази (tests/db: PGlite зі всіма міграціями, 1–2 с на файл) і тести скриптів сюди
// не потрапляють: правила в SQL/RLS перевіряє npm run mutation:sql (scripts/mutation-check.mjs).
// tests/org/english.test.ts (AC-LANG-01) сканує файли репо через `git ls-files`, а в пісочниці Stryker (.stryker-tmp)
// немає .git — пробний прогін падає. Мутацій src/lib цей тест не стосується: він перевіряє тексти, а не правила.
export default mergeConfig(
  base,
  defineConfig({ test: { exclude: ["tests/db/**", "tests/scripts/**", "tests/org/english.test.ts"] } }),
);
