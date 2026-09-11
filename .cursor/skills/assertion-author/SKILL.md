---
name: assertion-author
description: >
  Use when writing the assertion block of a generated test. Distinguishes a
  real assertion from a "test that just runs" — the #1 pattern the
  code-reviewer subagent and the afterFileEdit hook both check for.
---

# Skill: Assertion Author

## Rules this skill enforces
1. Every test has at least one assertion tied to the ticket's acceptance
   criteria — not just a "page loaded without error" smoke check.
2. Negative cases get their own assertion, not a comment saying "should fail."
3. Assertions on async UI state use Playwright's built-in retrying assertions
   (`expect(locator).to_have_text(...)`), never a manual `time.sleep()`
   followed by a plain `assert`. `golden_dataset/dirty/dirty_01.py` is a
   worked example of this exact violation for calibration.
