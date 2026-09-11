import { test, expect } from '@playwright/test';

// DIRTY: dirty-03 — the exact mistake this demo itself shipped in an
// earlier draft: reaching for a raw Playwright locator method
// (.isEnabled()) and asserting the boolean it returns, instead of using a
// web-first assertion. Kept here on purpose as a calibration case, not
// hidden.
//
// Caught by playwright/prefer-web-first-assertions: .isEnabled() +
// .toBe(true) should be expect(locator).toBeEnabled().
//
// What ESLint does NOT catch here, and why that matters: this test also
// bypasses OnboardingPage entirely, calling page.getByRole(...) straight
// in the test body. playwright/no-raw-locators does not fire on this —
// that rule only flags CSS/XPath-style page.locator(...) calls, and
// getByRole is exactly the locator method it wants you to use instead. So
// nothing in static analysis flags "this should have gone through the
// POM." That's a job for code-reviewer (or a human), not a linter — a
// second, real reason the semantic gate exists alongside static checks.
//
// Also worth calibrating in: prefer-web-first-assertions only matches a
// *raw* Playwright locator method call. If this same boolean were returned
// from a custom Page Object method instead (e.g.
// `onboarding.isFinishEnabledSomehow()`), ESLint would not catch it either
// — the method boundary hides the pattern from the linter. That's exactly
// why pom-builder's rule against wrapping locator state in boolean methods
// exists, and why code-reviewer still has to check for this shape even
// when static analysis is clean.

test('finish button enabled after selection (raw locator, boolean assert)', async ({ page }) => {
  await page.goto('/onboarding/wizard');

  const isEnabled = await page.getByRole('button', { name: 'Finish' }).isEnabled();
  expect(isEnabled).toBe(true);
});
