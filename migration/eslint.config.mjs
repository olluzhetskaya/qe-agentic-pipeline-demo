import js from '@eslint/js';
import globals from 'globals';
import playwright from 'eslint-plugin-playwright';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'node_modules/**',
      'sut/**',
      'golden_dataset/dirty/**',
      'playwright-report/**',
      'test-results/**',
      'out/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    files: ['tests/**/*.spec.ts', 'golden_dataset/clean/**/*.spec.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': 'error',
      'playwright/expect-expect': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-raw-locators': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/require-top-level-describe': 'error',
      'playwright/require-tags': 'error',
    },
  },
  {
    files: ['src/**/*.ts', 'pages/**/*.ts', 'tests/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/validation/**/*.ts'],
    rules: {
      'sonarjs/cognitive-complexity': 'off',
    },
  },
];
