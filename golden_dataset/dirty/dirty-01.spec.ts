import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// DIRTY: dirty-01 — seeded violation of assertion-author's rule 3
// (page.waitForTimeout instead of an explicit wait, plus an assertion that
// isn't tied to any acceptance criterion).
//
// Caught two independent ways: playwright/no-wait-for-timeout and
// sonarjs/no-fixed-wait-in-tests fire on the same line. A third ast-grep
// copy of waitForTimeout was dropped — ESLint already owns that pattern.

test('finish button bad pattern', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.gotoWizard();
  await onboarding.selectBenefitPlan('Dental');

  await page.waitForTimeout(3000); // violation: hardcoded wait
  expect(page.url()).toBeTruthy(); // violation: not a real assertion
});
