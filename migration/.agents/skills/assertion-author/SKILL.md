---
name: assertion-author
description: >
  Use when writing the assertion block of a generated test. Distinguishes a
  real assertion from a "test that just runs" — the #1 pattern the
  code-reviewer agent and the afterFileEdit hook both check for.
---

# Skill: Assertion Author

## Rules this skill enforces

1. **Every test has a real assertion** tied to the ticket's acceptance
   criteria — not just `expect(page.url()).toBeTruthy()`. ESLint's
   `playwright/expect-expect` rule catches the *absence* of an assertion;
   it cannot catch a present-but-meaningless one — that's what code-reviewer
   is for.

2. **Negative cases get their own assertion**, not a comment saying "should fail."

3. **Never `waitForTimeout()`.** Use Playwright's built-in retrying assertions
   (`await expect(locator).toBeVisible()`, `await expect(locator).toHaveText(...)`)
   as both the wait and the assertion in one call.
   See `golden_dataset/dirty/` for the hardcoded-wait example.

4. **Always assert on a Locator, never on a boolean returned by an `is*()`
   call** — `await expect(locator).toBeEnabled()`, not
   `expect(await locator.isEnabled()).toBe(true)`.
   See `golden_dataset/dirty/` for the boolean-assertion calibration.
   ESLint's `playwright/prefer-web-first-assertions` catches a *raw*
   locator method in the test body; once it's hidden behind a custom POM
   method, the linter can't see it — pom-builder rule 6 is what prevents
   that wrapping.

5. **Import from `@fixtures`, not `@playwright/test` directly.** The fixture
   provides a pre-instantiated POM and re-exports `expect`. If your test
   imports `{ test, expect }` from `@playwright/test` instead of `@fixtures`,
   it bypasses POM injection.

6. **Never hard-code entity IDs or fixture values as string literals.**
   Tenant IDs, plan names, and employee IDs belong in `src/data/` and
   should be imported from there. See `golden_dataset/dirty/` for the
   hard-coded-ID calibration.

7. **No module-scope mutable state.** Never declare a `let` at the top of
   a spec file and mutate it inside `test()` callbacks. Tests must be
   independently runnable in any order in any worker.
   See `golden_dataset/dirty/` for the shared-state calibration.

## Anti-pattern table

| Anti-pattern | What to use instead | Caught by |
|---|---|---|
| `page.waitForTimeout(3000)` | `await expect(locator).toBeVisible()` | ESLint `playwright/no-wait-for-timeout` |
| `expect(page.url()).toBeTruthy()` | `await expect(page).toHaveURL(/pattern/)` | code-reviewer |
| `expect(await locator.isEnabled()).toBe(true)` | `await expect(locator).toBeEnabled()` | ESLint |
| `import { test } from '@playwright/test'` | `import { test } from '@fixtures'` | ESLint `no-restricted-imports`, code-reviewer |
| Hard-coded `'tenant-growth-01'` | `Tenants.growth01.id` from `@fixtures` | ESLint `no-restricted-syntax`, code-reviewer for non-ID values |
| Module-scope `let x` mutated in `test()` | Fixture or local `const` per test | ESLint `no-restricted-syntax` |
| `try { ... } catch { ... }` in spec | Remove — let Playwright surface errors | ESLint `no-restricted-syntax` |
| Flat `test(...)` without `test.describe` | `test.describe('Feature', { tag: [Tags.*] }, () => { ... })` | ESLint `require-top-level-describe`, `require-tags` |
| No `test.step()` inside a test | Wrap phases: `await test.step('Given: ...', async () => {...})` | code-reviewer |

## References

- `golden_dataset/clean/` — describe + tag + `test.step` + web-first + data layer
- `tests/` — full structure with `test.setTimeout`
- `golden_dataset/dirty/` — waitForTimeout, boolean assertions, hard-coded IDs, shared state
