import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// GOLDEN: clean-01 — Finish button disabled before plan selection (AC-1).
// Why this is 'clean': asserts directly on the Locator with a web-first
// matcher (toBeDisabled), which auto-retries — never a boolean snapshot
// via a wrapper method. No waitForTimeout. No raw locator outside the POM.

test('finish button disabled before plan selection', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');

  await expect(onboarding.finishButton).toBeDisabled();
});
