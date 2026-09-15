import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

/** Compile-only Page Object for the clean migration calibration spec. */
export class CalibrationPage extends BasePage {
  public readonly finishButton: Locator;

  constructor(page: Page) {
    super(page);
    this.finishButton = page.getByRole('button', { name: 'Finish' });
  }

  async open(): Promise<void> {
    await this.goto('/calibration');
  }
}
