import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// Hand-written reference test — this is what test-generator's output is
// supposed to look like. Compare against golden_dataset/clean/clean-01.spec.ts:
// same pattern, same skill rules applied. Note the assertions are on
// Locators (onboarding.finishButton), never on a boolean returned by a
// custom method — see the design note in src/pages/onboarding-page.ts.

test('finish button disabled before plan selection', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');

  await expect(onboarding.finishButton).toBeDisabled();
});

test('finish button enabled after plan selection', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');
  await onboarding.selectBenefitPlan('Dental');

  await expect(onboarding.finishButton).toBeEnabled();
});
