import { test, expect, Tags } from '@fixtures';

// DIRTY: dirty-06 — a value owned by a typed fixture, copied in as a literal.
//
// Everything else here is correct: @fixtures import, POM locator, web-first
// assertion. The only fault is that the expected value is a copy of
// Employees.midOnboarding.onboardingStatus, so the spec drifts the moment the
// fixture changes. ESLint's ID-shaped literal rule does not reach this string.
//
// quality-gates.ts collects the scalars declared in src/data/ catalogs and
// flags any that reappear as a literal — it never needs to know that this
// particular value is an onboarding status.

test.describe('Copied fixture scalar', { tag: [Tags.onboarding] }, () => {
  test('hard-codes a fixture-owned expected value', async ({ onboarding }) => {
    await onboarding.gotoWizard();

    await expect(onboarding.statusBadge).toHaveText('profile_complete'); // violation
  });
});
