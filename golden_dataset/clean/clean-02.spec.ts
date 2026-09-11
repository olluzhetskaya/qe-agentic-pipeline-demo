import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// GOLDEN: clean-02 — no cross-tenant BenefitPlan leakage (AC-3).
// Why this is 'clean': directly tests the #1 regression risk called out in
// wiki/business_domain.md (tenant isolation), using a Growth-tier fixture as
// that rule specifies, not an arbitrary tenant.

const growthTierTenant = { id: 'tenant-growth-01', planIds: ['dental', 'vision'] };

test('no cross-tenant plans visible in dropdown', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto(`/onboarding/wizard?tenant=${growthTierTenant.id}`);

  const visiblePlans = await onboarding.visiblePlanOptions();

  expect(visiblePlans.every((plan) => growthTierTenant.planIds.includes(plan))).toBe(true);
});
