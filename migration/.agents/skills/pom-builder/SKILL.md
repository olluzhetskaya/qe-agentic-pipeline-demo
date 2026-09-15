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
already have a Page Object in `pages/`, or when `explore-browser` or
`legacy-locator-harvest` plus
`locator-strategy` supply replacement locators for an existing Page Object.

New or repaired locators come from a live scrape, or from
`legacy-locator-harvest`, then from `locator-strategy`. Do not hard-code
guessed selectors. Do not copy `waitForTimeout`, XPath, hashed CSS, or
boolean `is*()` methods from the legacy POM.

## Rules this skill enforces

1. **Every Page class extends `BasePage`** (the base class under `src/pages/`).

2. **Locators are `private readonly` fields** by default, defined once at
   the top of the class — **unless a test needs to assert on them**, in
   which case expose them as `public readonly Locator` (see rule 6).

3. **Public action methods use business language** —
   `selectBenefitPlan(name)`, not `clickDropdownItem(x)`.

4. **No locator string outside the Page Object it belongs to.** A test file
   that contains a `page.locator(...)` call directly is a violation that
   ESLint's `playwright/no-raw-locators` and code-reviewer both flag.

5. **Interactions rely on the Locator's own auto-retry — never a manual
   wait.** `await this.finishButton.click()` is correct. A preceding
   `await expect(locator).toBeVisible()` is wrong: `click()` and `fill()`
   already retry attached/visible/stable/receives-events/enabled/editable
   until the action timeout, so the assertion checks less than the built-in
   gate does, burns a second timeout budget, and hides Playwright's
   actionability log behind an assertion failure. `page.waitForTimeout()` is
   never acceptable.

6. **Never wrap element state in an async boolean-returning method.**
   Expose the `Locator` itself as a `public readonly` field and let the test
   assert on it with a web-first matcher:
   `await expect(page.finishButton).toBeEnabled()`, not
   `expect(await page.isFinishEnabled()).toBe(true)`.
   Wrapping locator state in a boolean method loses auto-retry AND defeats
   ESLint's `playwright/prefer-web-first-assertions` rule — the linter can't
   see through the method boundary. `golden_dataset/dirty/` (boolean
   assertion) and the Page Objects under `pages/` show both sides.

7. **Don't import test data into the Page Object.** Tenant IDs, plan names,
   and other fixture values belong in `src/data/`, not hardcoded in the POM.
   The Page Object accepts dynamic values as method arguments
   (`selectBenefitPlan(planName: string)`) — callers pass values from the
   data layer.

## Fluent return pattern

Action methods return `this` to allow chaining in tests:
```typescript
await onboarding
  .goto('/onboarding/wizard')
  .then(() => onboarding.selectBenefitPlan(planName));
```
Or just sequentially — either is valid. The `Promise<this>` return type on
every action method is what makes chaining possible.

## Output shape

A single `.ts` file under `pages/`, following the existing Page Objects
there:

```typescript
export class MyPage extends BasePage {
  // Assertion target: public readonly
  readonly someButton: Locator = this.page.getByRole('button', { name: 'Submit' });

  // Internal only: private readonly
  private readonly dropdown: Locator = this.page.getByTestId('my-dropdown');
  private readonly optionFor = (name: string) => this.page.getByTestId(`option-${name}`);

  constructor(page: Page) { super(page); }

  async selectOption(name: string): Promise<this> {
    await this.dropdown.click();
    await this.optionFor(name).click();
    return this;
  }
}
```

## What ast-grep enforces

`no-boolean-method-in-pom.yml` fires on any `async methodName(...): Promise<boolean>`
in a class body — so there's no need to rely on code-reviewer alone to catch
rule 6 violations. The rule runs during `npm run lint:ast-grep` and on the
`pre-push` Husky hook.

## References

- `pages/` — generated Page Objects; `src/pages/` — `BasePage` (auto-retrying Locator API)
- `golden_dataset/dirty/` — what rule 6 prevents (boolean wrapper + `.toBe(true)`)
