import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// DIRTY: dirty-02 — syntactically PERFECT, semantically wrong.
//
// This uses the exact "correct" pattern (a real web-first assertion,
// asserted through the POM, no raw locator, no hardcoded wait) and still
// gets the test wrong: it checks Finish is ENABLED before plan selection —
// wiki/business_domain.md rule 1 says the opposite is correct. ESLint
// (playwright + sonarjs), ast-grep, and tsc all pass this file cleanly.
// Only a reviewer who reads wiki/business_domain.md — code-reviewer, or
// this demo's stop hook re-check — catches the inversion. This is the
// entire reason ADR-014 has a semantic gate distinct from static analysis:
// good Playwright hygiene and a correct test are two different questions.

test('finish enabled before selection (WRONG)', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto('/onboarding/wizard');

  await expect(onboarding.finishButton).toBeEnabled(); // inverts business rule 1
});
