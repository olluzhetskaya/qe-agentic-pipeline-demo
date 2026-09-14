/**
 * Extended Playwright test fixture — the preferred import for ALL spec files.
 *
 * Provides pre-instantiated Page Objects so tests never call
 * `new OnboardingPage(page)` inline. Also re-exports the typed data layer
 * so each spec has a single import surface.
 *
 * Usage:
 *   import { test, expect, Tenants, Employees, Plans } from '@fixtures';
 *
 *   test('...', async ({ onboarding }) => {
 *     const tenant = Tenants.growth01;
 *     await onboarding.gotoWizard(tenant.id);   // never the raw page fixture
 *     await expect(onboarding.finishButton).toBeDisabled();
 *   });
 *
 * Adding a new Page Object:
 *   1. Create the class under src/pages/ following pom-builder skill rules.
 *   2. Add a fixture entry below alongside `onboarding`.
 *   3. Export its type from the OnboardingFixtures intersection.
 */
import { test as base } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// Re-export so callers have one import line, not three
export { Tenants } from '@data/tenants';
export { Employees } from '@data/employees';
export { Plans } from '@data/plans';
export { Tags, testTimeouts } from '@data/constants';
export { expect } from '@playwright/test';

type OnboardingFixtures = {
  /** Pre-instantiated OnboardingPage — injected per test, fresh page context */
  onboarding: OnboardingPage;
};

export const test = base.extend<OnboardingFixtures>({
  onboarding: async ({ page }, use) => {
    await use(new OnboardingPage(page));
  },
});
