import { test, expect, Tenants, Tags, testTimeouts } from '@fixtures';

// Hand-written reference test — demonstrates the full telecom-style structure:
//   • test.describe with tag annotations (Tags.* from constants)
//   • test.setTimeout for predictable CI behaviour
//   • test.step for named, traceable steps in Playwright's HTML report
//   • @fixtures import (POM injection + data layer in one line)
//   • No string literals for URLs, tenant IDs, or plan names

test.describe('Submission gating', { tag: [Tags.smoke, Tags.onboarding] }, () => {
  test.setTimeout(testTimeouts.standard);

  test('finish button disabled before plan selection', async ({ onboarding }) => {
    await test.step('Given: Employee opens wizard with no plan selected', async () => {
      await onboarding.gotoWizard();
    });

    await test.step('Then: Finish button is disabled', async () => {
      await expect(onboarding.finishButton).toBeDisabled();
    });
  });

  test('finish button enabled after plan selection', async ({ onboarding }) => {
    const planName = Tenants.growth01.defaultPlanLabel;

    await test.step(`Given: Employee selects plan "${planName}"`, async () => {
      await onboarding.gotoWizard();
      await onboarding.selectBenefitPlan(planName);
    });

    await test.step('Then: Finish button is enabled', async () => {
      await expect(onboarding.finishButton).toBeEnabled();
    });
  });
});

test.describe('Tenant isolation', { tag: [Tags.onboarding] }, () => {
  test.setTimeout(testTimeouts.standard);

  test('no cross-tenant plans visible in dropdown', async ({ onboarding }) => {
    const tenant = Tenants.growth01;

    await test.step(`Given: Employee of ${tenant.id} opens plan dropdown`, async () => {
      await onboarding.gotoWizard(tenant.id);
      await onboarding.openPlanDropdown();
    });

    await test.step('Then: Only this tenant\'s plans are visible', async () => {
      await expect(onboarding.planOptions).toHaveText([...tenant.planLabels]);
    });
  });
});
