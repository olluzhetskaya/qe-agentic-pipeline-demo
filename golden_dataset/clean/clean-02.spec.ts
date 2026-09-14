import { test, expect, Tenants, Tags } from '@fixtures';

// GOLDEN: clean-02 — no cross-tenant BenefitPlan leakage (AC-3).
// Why this is 'clean':
//   - Tenant ID and expected plan labels from Tenants.growth01 — no inline objects
//   - test.describe with Tags.onboarding — grep-able in CI
//   - gotoWizard(tenant.id) not goto('/onboarding/wizard?tenant=...')
//   - toHaveText() on a multi-element Locator: retries AND checks full ordered set

test.describe('Tenant isolation', { tag: [Tags.onboarding] }, () => {
  test('no cross-tenant plans visible in dropdown', async ({ onboarding }) => {
    const tenant = Tenants.growth01;

    await test.step(`Open dropdown as employee of ${tenant.id}`, async () => {
      await onboarding.gotoWizard(tenant.id);
      await onboarding.openPlanDropdown();
    });
    await test.step('Assert only tenant plans are visible', async () => {
      await expect(onboarding.planOptions).toHaveText([...tenant.planLabels]);
    });
  });
});
