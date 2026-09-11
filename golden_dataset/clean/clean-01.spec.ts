import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// GOLDEN: clean-01 — Finish button disabled before plan selection (AC-1).
// Why this is 'clean': explicit assertion tied to the AC, no waitForTimeout,
// uses the Page Object's public methods only (no raw locator in the test file).

test('finish button disabled before plan selection', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');

  expect(await onboarding.isFinishEnabled()).toBe(false);
});
