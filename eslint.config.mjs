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
      // (.agents/agents/code-reviewer.md + src/observability/stop.ts) covers
      // the half a linter can't see (is the assertion testing the right thing).
      'playwright/no-wait-for-timeout': 'error',
      'playwright/expect-expect': 'error',
      'playwright/missing-playwright-await': 'error',
      'playwright/no-conditional-in-test': 'error',
      'playwright/no-conditional-expect': 'error',
      'playwright/no-raw-locators': 'error',
      'playwright/require-top-level-describe': 'error',
      'playwright/require-tags': 'error',

      // -----------------------------------------------------------------------
      // Telecom best-practice: no try-catch inside spec files.
      // Tests must fail loudly — a caught exception silently swallows the
      // failure. Let Playwright surface errors directly. code-reviewer checks
      // for this shape too, but making it a lint error means the deterministic
      // gate catches it without the semantic gate needing to.
      // -----------------------------------------------------------------------
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TryStatement',
          message:
            'No try-catch in spec files — let Playwright surface the error directly. ' +
            'Catching exceptions silently swallows test failures.',
        },
        {
          selector: 'Program > VariableDeclaration[kind="let"]',
          message:
            'No module-scope mutable state in specs — use a fixture or a const inside the test.',
        },
        {
          selector: 'Literal[value=/(tenant|emp|plan)-/]',
          message:
            'Entity IDs must come from the @fixtures data layer, not string literals.',
        },
        {
          selector: 'NewExpression[callee.name=/Page$/]',
          message:
            'Page Objects must be injected by @fixtures, not constructed in a spec.',
        },
      ],

      // Locator calls in a spec body: `page.locator()` is already covered by
      // no-raw-locators and any `page` identifier by ast-grep no-page-in-spec.
      // This adds only the getBy* methods those two don't reach.
      'playwright/no-restricted-locators': [
        'error',
        ['getByRole', 'getByText', 'getByTestId', 'getByLabel'].map(type => ({
          type,
          message: 'Locators belong in a Page Object, not a spec.',
        })),
      ],

      // -----------------------------------------------------------------------
      // Telecom best-practice: spec files import from @fixtures only. The
      // fixture injects the POM and re-exports the data layer, so a direct
      // @playwright/test, @pages/* or @data/* import bypasses both.
      // -----------------------------------------------------------------------
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@playwright/test', '@data/*', '@pages/*', '../data/*', '../pages/*'],
              message:
                "Spec files must import test, expect, POMs, and data from '@fixtures'.",
            },
          ],
        },
      ],
    },
  },
  {
    // Page Object and component files — enforce no boolean-state methods.
    // The real risk is POM files calling `test()` / `test.describe()` etc.
    // (which would bake test-runner coupling into production page code).
    // We enforce this via the ast-grep no-boolean-method-in-pom rule rather
    // than banning the whole @playwright/test import, since POMs legitimately
    // import Locator and Page to type their fields and constructors.
    files: ['src/pages/**/*.ts', 'src/components/**/*.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'ClassDeclaration:not([id.name="BasePage"]):not([superClass.name="BasePage"])',
          message: 'Every Page Object class must extend BasePage.',
        },
        {
          selector:
            'PropertyDefinition[typeAnnotation.typeAnnotation.typeName.name="Locator"]' +
            ':not([readonly=true])',
          message: 'Locator fields must be readonly.',
        },
      ],
      // Ban importing `test` (the test runner function) inside page/component files.
      // Locator, Page, expect are all fine; test() is not.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@playwright/test',
              importNames: ['test'],
              message:
                "Page Object files must not import 'test' from @playwright/test. " +
                'Only Locator, Page, expect and similar utilities belong in a POM.',
            },
          ],
          patterns: [
            {
              group: ['@data/*', '../data/*'],
              message: 'Page Objects accept dynamic values; they must not import test data.',
            },
          ],
        },
      ],
    },
  },
  {
    // Fixture files bridge data layer → POM → test.
    // They legitimately import from @pages/* to instantiate page objects.
    // They must not import directly from @playwright/test's test runner (test()),
    // but they re-export `expect` and `test` from the base.extend() wrapper.
    files: ['src/fixtures/**/*.ts'],
    rules: {},
  },
  {
    // Observability hooks are TypeScript Node scripts run via tsx.
    // They live in src/observability/ but are Node processes, not browser code,
    // so they get Node globals and relaxed rules (top-level await, process, etc.).
    files: ['src/observability/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'sonarjs/no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Repository validators intentionally aggregate many independent
    // invariants in one pass. Complexity here is the rule inventory, not
    // application branching; individual findings remain explicit and tested.
    files: ['src/validation/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      'sonarjs/cognitive-complexity': 'off',
    },
  },
];
