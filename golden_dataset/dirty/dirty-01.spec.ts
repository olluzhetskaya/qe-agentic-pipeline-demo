import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// DIRTY: dirty-01 — seeded violation of assertion-author's rule 3
// (page.waitForTimeout instead of an explicit wait, plus an assertion that
// isn't tied to any acceptance criterion).
//
// This should score FAIL on the semantic gate even though it "runs" — and,
// on purpose, it also demonstrates why lint alone isn't enough: without
// eslint-plugin-playwright's no-wait-for-timeout rule enabled, this file
// would pass static analysis cleanly while still being a bad test.

test('finish button bad pattern', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');
  await onboarding.selectBenefitPlan('Dental');

  await page.waitForTimeout(3000); // violation: hardcoded wait
  expect(page.url()).toBeTruthy(); // violation: not a real assertion
});
