import { test, expect, Employees, Tags } from '@fixtures';

// GOLDEN: clean-05 — the expected value is read from the typed fixture.
// Why this is 'clean':
//   - No string literal in the spec: the status comes from Employees.*
//   - The element (and its test id) stays in OnboardingPage as statusBadge
//   - Web-first assertion on the Locator, so it auto-retries
//
// Contrast with dirty-06, which copies the same value in as a literal.

test.describe('Fixture-backed expected value', { tag: [Tags.onboarding] }, () => {
  test('asserts the status a fixture declares', async ({ onboarding }) => {
    await test.step('Navigate to wizard', async () => {
      await onboarding.gotoWizard();
    });
    await test.step('Assert status matches the fixture', async () => {
      await expect(onboarding.statusBadge)
        .toHaveText(Employees.midOnboarding.onboardingStatus);
    });
  });
});
