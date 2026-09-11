import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// GOLDEN: clean-02 — no cross-tenant BenefitPlan leakage (AC-3).
// Why this is 'clean': directly tests the #1 regression risk called out in
// wiki/business_domain.md (tenant isolation), using a Growth-tier fixture as
// that rule specifies. toHaveText() against a multi-element Locator is
// itself a web-first assertion — it retries and checks the exact set AND
// order in one call, instead of fetching text into an array and comparing
// with plain .every()/.toBe(), which would snapshot once and not retry.

const growthTierTenant = { id: 'tenant-growth-01', planLabels: ['Dental', 'Vision'] };

test('no cross-tenant plans visible in dropdown', async ({ page }) => {
  const onboarding = new OnboardingPage(page);
  await onboarding.goto(`/onboarding/wizard?tenant=${growthTierTenant.id}`);
  await onboarding.openPlanDropdown();

  await expect(onboarding.planOptions).toHaveText(growthTierTenant.planLabels);
});
