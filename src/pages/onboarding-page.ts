import { type Locator, type Page } from '@playwright/test';
import { BasePage } from './base-page';

/**
 * OnboardingPage — generated via the test-generation skill following
 * pom-builder and locator-strategy.
 *
 * Deliberate design choice, per pom-builder skill rule 6: locators are
 * exposed as public `readonly Locator` fields, not wrapped in async
 * boolean-returning methods like `isFinishEnabled()`. A test asserts
 * directly on the Locator with Playwright's web-first assertions
 * (`await expect(page.finishButton).toBeEnabled()`), which auto-retries.
 * A method that awaits `.isEnabled()` internally and returns a plain
 * boolean throws that retry away — and, as it turns out, also hides the
 * pattern from ESLint: `playwright/prefer-web-first-assertions` only
 * matches a raw Playwright locator method call, not a call one level
 * behind your own method. Wrapping state in a boolean method doesn't just
 * lose auto-retry, it defeats the linter too.
 */
export class OnboardingPage extends BasePage {
  /** Route owned by this Page Object — never repeat this string in a test body. */
  static readonly PATH = '/onboarding/wizard';

  private readonly benefitPlanDropdown: Locator = this.page.getByTestId('benefit-plan-select');
  readonly finishButton: Locator = this.page.getByRole('button', { name: 'Finish' });
  readonly planOptions: Locator = this.page.getByTestId('plan-option');
  /** Renders the Employee's onboarding status — the expected value comes from a fixture. */
  readonly statusBadge: Locator = this.page.getByTestId('onboarding-status');
  private readonly planOption = (name: string) => this.page.getByTestId(`plan-option-${name}`);

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to the onboarding wizard.
   * Pass `tenantId` to scope the session to a specific tenant
   * (use `Tenants.*` from `src/data/tenants.ts` — never a raw string).
   */
  async gotoWizard(tenantId?: string): Promise<this> {
    const url = tenantId
      ? `${OnboardingPage.PATH}?tenant=${tenantId}`
      : OnboardingPage.PATH;
    await this.goto(url);
    return this;
  }

  async selectBenefitPlan(planName: string): Promise<this> {
    await this.benefitPlanDropdown.click();
    await this.planOption(planName).click();
    return this;
  }

  async clickFinish(): Promise<this> {
    await this.finishButton.click();
    return this;
  }

  async openPlanDropdown(): Promise<this> {
    await this.benefitPlanDropdown.click();
    return this;
  }
}
