import { test, expect } from '@fixtures';

// DIRTY: dirty-05 — shared mutable state across tests (data isolation violation).
//
// The `selectedPlan` variable is declared at module scope and mutated inside
// test-1, then conditionally read by test-2.
//
// Why this is a problem:
//   1. In Playwright's default parallel mode, tests can run in separate
//      worker processes. A module-level variable in worker A is invisible
//      to worker B — test-2 sees `undefined` and the conditional makes
//      the assertion unreachable.
//   2. Retries, sharding, filtering, or running test-2 alone remove the
//      ordering assumption even when a local full-file run happens to pass.
//   3. The `if (selectedPlan)` guard silently turns test-2 into a no-op
//      instead of a clear failure — harder to diagnose than an outright
//      error.
//
// Static analysis catches this deterministically:
//   - ESLint `no-restricted-syntax` rejects module-scope `let`.
//   - eslint-plugin-playwright's `no-conditional-in-test` fires on the `if`
//     guard inside test-2, and `no-conditional-expect` rejects the assertion.
//
// The fix: move `selectedPlan` inside each test, or use a @fixtures fixture
// that re-creates state per test via `base.extend`.

let selectedPlan: string | undefined; // violation: mutable shared state at module scope

test('first test selects a plan', async ({ onboarding }) => {
  await onboarding.gotoWizard(); // violation: module-scope state
  await onboarding.selectBenefitPlan('Dental');
  selectedPlan = 'Dental'; // mutation: visible to other tests in same worker
  await expect(onboarding.finishButton).toBeEnabled();
});

test('second test reads shared state', async ({ onboarding }) => {
  await onboarding.gotoWizard(); // violation: module-scope state (read)
  if (selectedPlan) { // violation: conditional hides implicit ordering dependency
    await onboarding.selectBenefitPlan(selectedPlan);
    await expect(onboarding.finishButton).toBeEnabled();
  }
  // If selectedPlan is undefined (parallel worker, different order),
  // this test passes vacuously — a false-positive that hides a broken precondition.
});
