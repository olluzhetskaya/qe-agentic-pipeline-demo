import { test, expect, Tenants, Tags } from '@fixtures';

// GOLDEN: clean-03 — finish button enabled after plan selection (AC-2).
// Why this is 'clean':
//   - Imports from @fixtures (not @playwright/test directly)
//   - Plan name from Tenants.growth01.defaultPlanLabel — a named role, not
//     the string 'Dental' and not a positional planLabels[0] lookup
//   - test.describe with Tags.onboarding; test.step for trace readability
//   - gotoWizard() not goto('/...')
//   - Web-first assertion: toBeEnabled() retries automatically
//
// Contrast with dirty-04 which duplicates this test but hard-codes IDs.

test.describe('Submission gating', { tag: [Tags.onboarding] }, () => {
  test('finish button enabled after plan selection (data layer)', async ({ onboarding }) => {
    const planName = Tenants.growth01.defaultPlanLabel;

    await test.step(`Select plan "${planName}"`, async () => {
      await onboarding.gotoWizard();
      await onboarding.selectBenefitPlan(planName);
    });
    await test.step('Assert Finish is enabled', async () => {
      await expect(onboarding.finishButton).toBeEnabled();
    });
  });
});
