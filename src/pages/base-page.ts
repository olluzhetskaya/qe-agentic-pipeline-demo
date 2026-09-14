import { type Page } from '@playwright/test';

/**
 * BasePage — every generated Page Object extends this.
 *
 * Enforces the two POM rules that matter most for agent-generated code:
 *   1. No locator string ever appears outside a Page Object
 *      (see .agents/skills/pom-builder).
 *   2. Interactions go through the auto-retrying Locator API — never
 *      page.waitForTimeout(), and never a manual
 *      `await expect(locator).toBeVisible()` gate before an action.
 *      `Locator.click()` / `Locator.fill()` already retry the full
 *      actionability set (attached, visible, stable, receives events,
 *      enabled, editable) for the duration of the action timeout. A
 *      preceding toBeVisible() checks strictly less than that while
 *      spending a second timeout budget, and it reports failures as a
 *      flaky assertion instead of Playwright's actionability log
 *      (see .agents/skills/assertion-author, and eslint.config.mjs's
 *      playwright/no-wait-for-timeout rule).
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
