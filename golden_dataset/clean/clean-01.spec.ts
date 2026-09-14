import { test, expect, Tags } from '@fixtures';

// GOLDEN: clean-01 — Finish button disabled before plan selection (AC-1).
// Why this is 'clean':
//   - test.describe wraps the test with a tag annotation (Tags.*)
//   - test.step names each phase for Playwright's trace/HTML report
//   - gotoWizard() not goto('/...') — URL lives in OnboardingPage.PATH
//   - Web-first assertion on the Locator; no boolean snapshot, no wait

test.describe('Submission gating', { tag: [Tags.smoke, Tags.onboarding] }, () => {
  test('finish button disabled before plan selection', async ({ onboarding }) => {
    await test.step('Navigate to wizard', async () => {
      await onboarding.gotoWizard();
    });
    await test.step('Assert Finish is disabled', async () => {
      await expect(onboarding.finishButton).toBeDisabled();
    });
  });
});
