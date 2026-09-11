---
name: locator-strategy
description: >
  Use when a Page Object needs new locators. Enforces the locator priority
  order so generated tests don't rot the first time the DOM shifts.
---

# Skill: Locator Strategy

## Priority order (highest to lowest)
1. `getByTestId(...)` — always prefer this if a `data-testid` attribute exists.
2. Accessible role + name (`getByRole('button', { name: 'Finish' })`).
3. Visible text (`getByText(...)`) — only for stable, non-localized labels.
4. `locator('.css-class')` — last resort, and only if the class name is
   semantic (`.benefit-plan-card`), never a generated/hashed CSS Modules class.

## Hard rule
Never generate an XPath locator (`page.locator('xpath=...')`). If the only
available option is XPath, flag it back to the ticket as "needs a
data-testid" instead of writing brittle XPath. ESLint's
`playwright/no-raw-locators` rule enforces the shape of this at the
deterministic gate; this skill is what keeps the *content* of locators
maintainable in the first place.
