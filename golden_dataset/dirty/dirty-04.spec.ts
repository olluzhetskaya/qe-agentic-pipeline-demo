import { test, expect } from '@playwright/test';
import { OnboardingPage } from '@pages/onboarding-page';

// DIRTY: dirty-04 — data-layer bypass (hard-coded entity IDs and plan names).
//
// This test does the right thing in terms of Playwright hygiene — web-first
// assertion, no hardcoded waits, uses the POM. It's dirty for a different
// reason: the tenant ID ('tenant-growth-01') and plan labels (['Dental',
// 'Vision']) are string literals copied from production data, not imported
// from src/data/tenants.ts.
//
// Why that matters:
//   - If 'tenant-growth-01' is renamed or its plans change, this test
//     silently diverges from reality. With `Tenants.growth01` the compiler
//     and the data layer stay in sync automatically.
//   - Imports from @playwright/test directly instead of @fixtures — misses
//     the POM injection fixture, so the test still calls `new OnboardingPage`.
//
// ESLint deterministically catches the import, inline Page construction, and
// ID-shaped literal. The code-reviewer still checks generic plan-label strings,
// because syntax alone cannot know whether "Dental" is UI copy or fixture data.

test('no cross-tenant leakage (hardcoded IDs)', async ({ page }) => {
  const onboarding = new OnboardingPage(page); // violation: POM injected by @fixtures

  await onboarding.goto('/onboarding/wizard?tenant=tenant-growth-01'); // violation: hard-coded ID
  await onboarding.openPlanDropdown();

  await expect(onboarding.planOptions).toHaveText(['Dental', 'Vision']); // violation: hard-coded plan names
});
