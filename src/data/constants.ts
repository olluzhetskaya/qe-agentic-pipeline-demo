/**
 * Shared test constants for the QE pipeline demo.
 *
 * Centralise timeout and configuration values here so they're not scattered
 * across spec files as magic numbers. One change here propagates everywhere.
 *
 * Pattern from telecom-test-automation's src/data/test-constants.ts.
 */

export const testTimeouts = {
  /**
   * Standard test timeout — covers a single page interaction + assertion.
   * Use: `test.setTimeout(testTimeouts.standard)` at the top of a describe block.
   */
  standard: 30_000,

  /**
   * Extended timeout — for flows with multiple network roundtrips or
   * animation/transition waits. Use sparingly; prefer web-first assertions.
   */
  extended: 60_000,

  /**
   * Expect timeout — how long a single `await expect(...)` retries before failing.
   * Playwright's default is 5000ms; we raise it slightly for CI environments.
   */
  expect: 10_000,
} as const;

/**
 * Execution tags — how a suite is sliced in CI, not what it means to the
 * business. Usage:
 *   test.describe('Submission gating', { tag: [Tags.smoke, Tags.onboarding] }, () => { ... })
 *
 * CLI filter:
 *   npx playwright test --grep "@smoke"
 */
export const Tags = {
  smoke: '@smoke',
  onboarding: '@onboarding',
} as const;
