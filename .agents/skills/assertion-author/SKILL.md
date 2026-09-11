---
name: assertion-author
description: >
  Use when writing the assertion block of a generated test. Distinguishes a
  real assertion from a "test that just runs" — the #1 pattern the
  code-reviewer agent and the afterFileEdit hook both check for.
---

# Skill: Assertion Author

## Rules this skill enforces
1. Every test has at least one assertion tied to the ticket's acceptance
   criteria — not just `expect(page.url()).toBeTruthy()`. ESLint's
   `playwright/expect-expect` rule catches the *absence* of an assertion;
   it cannot catch a present-but-meaningless one — that's what code-reviewer
   is for.
2. Negative cases get their own assertion, not a comment saying "should fail."
3. Waits use Playwright's built-in retrying assertions
   (`await expect(locator).toHaveText(...)`), never `page.waitForTimeout()`
   followed by a plain `expect()`. `golden_dataset/dirty/dirty-01.spec.ts`
   is a worked example of this exact violation for calibration.
