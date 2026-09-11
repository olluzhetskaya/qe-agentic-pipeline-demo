import { type Locator, type Page, expect } from '@playwright/test';

/**
 * BasePage — every generated Page Object extends this.
 *
 * Enforces the two POM rules that matter most for agent-generated code:
 *   1. No locator string ever appears outside a Page Object
 *      (see .agents/skills/pom-builder).
 *   2. Every interaction waits explicitly — no page.waitForTimeout(), ever
 *      (see .agents/skills/assertion-author, and
 *      eslint.config.mjs's playwright/no-wait-for-timeout rule).
 */
export class BasePage {
  constructor(protected readonly page: Page) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  protected async clickWhenVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
    await locator.click();
  }

  protected async fillWhenVisible(locator: Locator, value: string): Promise<void> {
    await expect(locator).toBeVisible();
    await locator.fill(value);
  }
}
