---
name: locator-strategy
description: >
  Use when a Page Object needs new locators. Enforces the locator priority
  order so generated tests don't rot the first time the DOM shifts.
---

# Skill: Locator Strategy

## Input from explore-browser

When Stage 1 walks the UI, rank candidates from
`.agents/artifacts/explore-*.yaml` (`locators[]`) or from the standalone
locator-debug table. Do not invent a locator the page did not show. Put
the chosen locator only in a Page Object (`pom-builder`). Never paste a
scraped string into `src/tests/`.

## Priority order (highest → lowest)

| Priority | Strategy | Example | When to use |
|---|---|---|---|
| 1 | `getByTestId(...)` | `page.getByTestId('benefit-plan-select')` | Always first — if a `data-testid` exists, use it |
| 2 | Accessible role + name | `getByRole('button', { name: 'Finish' })` | Buttons, links, inputs with labels |
| 3 | Accessible label | `getByLabel('Select a plan')` | Form inputs |
| 4 | Visible text | `getByText('Dental')` | Only for stable, non-localized labels |
| 5 | Semantic CSS class | `locator('.benefit-plan-card')` | Last resort — class must be semantic and stable |

## Hard rules

- **Never generate XPath** (`page.locator('xpath=...')`). If XPath is the
  only option, flag it back to the ticket as "needs a `data-testid`".
  ESLint's `playwright/no-raw-locators` rule enforces the shape; this skill
  keeps the *content* of locators maintainable.

- **Never use generated/hashed CSS class names** (`locator('.css-3hj5v2')`).
  They change on every build. If the app uses CSS Modules, request a
  `data-testid` instead.

- **Never call a locator method outside a Page Object.** A test file that
  contains `page.getByRole(...)` inline is a violation — move it to the POM.
  ESLint's `playwright/no-raw-locators` fires on `page.locator()` calls
  specifically; `page.getByRole()` inline won't trigger it, but code-reviewer
  will catch it as a POM violation.

## Locator exposure rules (connects to pom-builder rule 6)

- Locators used **only internally** (inside action methods): `private readonly`.
- Locators used **by tests for assertions** (`expect(onboarding.finishButton)`):
  `public readonly Locator`. Exposing the Locator — not a boolean method —
  is what lets tests use web-first assertions with auto-retry.

## Anti-pattern table

| Anti-pattern | Problem | Alternative |
|---|---|---|
| `page.locator('xpath=//button[2]')` | Fragile, positional | Add `data-testid`, use `getByTestId` |
| `page.locator('.css-3hj5v2')` | Breaks on rebuild | Add `data-testid` or use `getByRole` |
| `page.getByRole(...)` in test body | Bypasses POM | Move locator to Page Object |
| `isEnabled()` returning `boolean` | Loses auto-retry | Expose Locator, assert with `toBeEnabled()` |

## When to request a `data-testid`

If no `getByRole` / `getByLabel` selects the element uniquely and there's no
stable semantic CSS class, stop and flag it:
> "This element needs a `data-testid` before a stable locator can be written."

Prefer this over writing brittle locators that will need updating on the
next UI refactor.
