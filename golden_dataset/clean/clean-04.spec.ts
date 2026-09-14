import { test, expect, Tenants, Tags } from '@fixtures';

// GOLDEN: clean-04 — Starter-tier plan count (wiki `plan-tier-limits`).
// Why this is 'clean':
//   - Tenants.starter01 from data layer — explicit about which business rule is tested
//   - test.describe with Tags.onboarding — grep-able in CI
//   - gotoWizard(tenant.id) — URL owned by POM, not hard-coded here
//   - Two web-first assertions: count enforces the limit; text confirms the right plan
//
// Not a case on the current KB-4821 design (`TC-1`–`TC-3`). This file is the
// PASS example for a later story that designs the Starter-tier limit.

test.describe('Plan tier limits', { tag: [Tags.onboarding] }, () => {
  test('starter-tier tenant shows exactly one plan in dropdown', async ({ onboarding }) => {
    const tenant = Tenants.starter01;

    await test.step('Open dropdown as Starter-tier tenant', async () => {
      await onboarding.gotoWizard(tenant.id);
      await onboarding.openPlanDropdown();
    });
    await test.step('Assert exactly one plan is shown', async () => {
      await expect(onboarding.planOptions).toHaveCount(1);
    });
    await test.step('Assert plan label matches Starter configuration', async () => {
      await expect(onboarding.planOptions).toHaveText([...tenant.planLabels]);
    });
  });
});
