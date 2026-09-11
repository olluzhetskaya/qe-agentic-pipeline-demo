---
name: pom-builder
description: >
  Use when generating or modifying a Page Object for the onboarding platform.
  Builds a Page class that extends BasePage, encapsulates locators as private
  readonly fields, and exposes fluent public methods (not raw locator access).
---

# Skill: POM Builder

## When to use
Any time a generated test needs to interact with a page/screen that doesn't
already have a Page Object in `src/pages/`.

## Rules this skill enforces
1. Every Page class extends `BasePage` (see `src/pages/base-page.ts`).
2. Locators are `private readonly` fields, defined once, at the top of the class — **unless a test needs to assert against them directly**, in which case expose them as `public readonly Locator` fields (see rule 6).
3. Public *action* methods are business language
   (`selectBenefitPlan(name)`, not `clickDropdownItem(x)`).
4. No locator string appears outside the Page Object it belongs to — a test
   file that contains a `page.locator(...)` call directly is a violation the
   code-reviewer agent and ESLint's `playwright/no-raw-locators` rule should
   both flag.
5. Every interaction method awaits an explicit wait
   (`await expect(locator).toBeVisible()`) before acting — never a bare
   `.click()` with no prior wait, and never `page.waitForTimeout()`.
6. **Never wrap element state in an async boolean-returning method**
   (`isFinishEnabled()`, `isVisible()`, etc.). Expose the `Locator` itself
   as a public readonly field instead, and let the test assert on it with a
   web-first matcher: `await expect(page.finishButton).toBeEnabled()`, not
   `expect(await page.isFinishEnabled()).toBe(true)`. This isn't just style
   — a boolean method call is a one-time snapshot with no retry, while a
   web-first assertion on a Locator polls until the condition holds or the
   timeout elapses. It also has a sharper failure mode worth knowing:
   ESLint's `playwright/prefer-web-first-assertions` rule only matches a
   *raw* Playwright locator method call (`.isEnabled()` etc. called
   directly) — once that call is hidden one level behind your own method
   name, the linter can no longer see the pattern at all. Wrapping locator
   state in a boolean method doesn't just lose auto-retry, it defeats
   static analysis too. `src/pages/onboarding-page.ts` and
   `golden_dataset/dirty/dirty-03.spec.ts` show both sides of this.

## Output shape
A single `.ts` file under `src/pages/`, following the pattern in
`src/pages/onboarding-page.ts`.
