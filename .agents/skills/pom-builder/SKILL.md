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
2. Locators are `private readonly` fields, defined once, at the top of the class.
3. Public methods are actions or queries in business language
   (`selectBenefitPlan(name)`, not `clickDropdownItem(x)`).
4. No locator string appears outside the Page Object it belongs to — a test
   file that contains a `page.locator(...)` call directly is a violation the
   code-reviewer agent and ESLint's `playwright/no-raw-locators` rule should
   both flag.
5. Every interaction method awaits an explicit wait
   (`await expect(locator).toBeVisible()`) before acting — never a bare
   `.click()` with no prior wait, and never `page.waitForTimeout()`.

## Output shape
A single `.ts` file under `src/pages/`, following the pattern in
`src/pages/onboarding-page.ts`.
