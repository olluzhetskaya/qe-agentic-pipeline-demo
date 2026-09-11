import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import sonarjs from 'eslint-plugin-sonarjs';
import globals from 'globals';

export default [
  {
    // Global ignores. golden_dataset/dirty/ is deliberately NOT here — those
    // fixtures are meant to fail when ESLint is pointed at them directly
    // (see README's dry-run steps). Keeping them out of the default `npm
    // run lint` sweep is handled in package.json's lint script instead,
    // which names explicit paths rather than linting the whole repo — the
    // way a real CI gate never lints known-bad fixtures as if they were
    // shipped code, without making the fixtures literally unlintable.
    ignores: ['node_modules/**', 'playwright-report/**', 'test-results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // eslint-plugin-sonarjs is Sonar's own JS/TS rule set, exposed as a real,
  // locally-runnable ESLint plugin — no server required. This is the actual
  // Sonar coverage exercised by this demo's afterFileEdit hook.
  // sonar-project.properties still exists separately for a live
  // SonarQube/SonarCloud server in CI, which adds cross-run tracking and a
  // quality-gate history this local plugin doesn't provide on its own.
  sonarjs.configs.recommended,
  {
    // Scoped to test files only, per eslint-plugin-playwright's own guidance —
    // page.ts POM files don't contain test()/expect() blocks, so the
    // Playwright-specific rules don't apply there.
    files: ['src/tests/**/*.spec.ts', 'golden_dataset/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // assertion-author skill, rule 3: never a hardcoded wait —
      // this is the deterministic half of that rule; the semantic gate
      // (.agents/agents/code-reviewer.md + .cursor/hooks/stop.cjs) covers
      // the half a linter can't see (is the assertion testing the right thing).
      'playwright/no-wait-for-timeout': 'error',
      'playwright/expect-expect': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/no-conditional-in-test': 'warn',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-raw-locators': 'error',
    },
  },
  {
    // Cursor's hook scripts are plain Node CommonJS, not part of the
    // browser-facing TS project — they get their own, much lighter rule set.
    files: ['.cursor/hooks/**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];
