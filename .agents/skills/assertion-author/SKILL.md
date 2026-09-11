---
name: assertion-author
description: >
  Use when writing the assertion block of a generated test. Distinguishes a
  real assertion from a "test that just runs" — the #1 pattern the
  code-reviewer agent and the afterFileEdit hook both check for.
---

# Skill: Assertion Author

## Rules this skill enforces
1. Every test has at least one assertion tied to the ticket's acceptance
   criteria — not just `expect(page.url()).toBeTruthy()`. ESLint's
   `playwright/expect-expect` rule catches the *absence* of an assertion;
   it cannot catch a present-but-meaningless one — that's what code-reviewer
   is for.
2. Negative cases get their own assertion, not a comment saying "should fail."
3. Waits use Playwright's built-in retrying assertions
   (`await expect(locator).toHaveText(...)`), never `page.waitForTimeout()`
   followed by a plain `expect()`. `golden_dataset/dirty/dirty-01.spec.ts`
   is a worked example of this exact violation for calibration.
4. **Always assert on a Locator, never on a boolean returned by an
   `is*()` call** — `await expect(locator).toBeEnabled()`, not
   `expect(await locator.isEnabled()).toBe(true)`. Same rule, restated from
   the caller's side: pom-builder rule 6 is why the Page Object exposes the
   Locator in the first place; this is what you do with it once it's
   exposed. `golden_dataset/dirty/dirty-03.spec.ts` is the calibration case
   — note it fails specifically because the raw `.isEnabled()` call is
   right there in the test, not hidden behind a Page Object method. ESLint's
   `playwright/prefer-web-first-assertions` catches this shape; a second,
   coarser ast-grep rule (`.ast-grep/rules/no-boolean-literal-assertion.yml`)
   flags any `toBe(true/false)` as a backup, since it can't tell whether the
   boolean came from a locator or not.
