import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// DIRTY: dirty-01 — seeded violation of assertion-author's rule 3
// (page.waitForTimeout instead of an explicit wait, plus an assertion that
// isn't tied to any acceptance criterion).
//
// Caught three independent ways: playwright/no-wait-for-timeout,
// sonarjs/no-fixed-wait-in-tests, and the ast-grep rule all fire on the
// same line — proof that overlapping static tools aren't redundant, they're
// three chances to catch the same real mistake.

test('finish button bad pattern', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');
  await onboarding.selectBenefitPlan('Dental');

  await page.waitForTimeout(3000); // violation: hardcoded wait
  expect(page.url()).toBeTruthy(); // violation: not a real assertion
});
