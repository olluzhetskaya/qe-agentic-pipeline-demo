import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// DIRTY: dirty-02 — syntactically fine, semantically wrong.
//
// This is the case a *static* linter can never catch, which is why the
// pipeline has a separate semantic/judge gate. The test asserts Finish is
// ENABLED before plan selection — wiki/business_domain.md rule 1 says the
// opposite is correct. ESLint and ast-grep both pass this file cleanly;
// only code-reviewer (or the stop hook's re-check) catches the inversion.

test('finish enabled before selection (WRONG)', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');

  expect(await onboarding.isFinishEnabled()).toBe(true); // inverts business rule 1
});
