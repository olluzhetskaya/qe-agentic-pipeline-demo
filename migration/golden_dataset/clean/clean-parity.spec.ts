import { test, expect, Tags } from '@fixtures';

// GOLDEN (migration): Then from Gherkin is a web-first assertion.
// Calibrates migration-code-reviewer PASS bar. Not a product spec.

test.describe('Migrated scenario parity', { tag: [Tags.smoke] }, () => {
  test('preserves the Then as an assertion', async ({ calibration }) => {
    await test.step('Given the wizard is open', async () => {
      await calibration.open();
    });
    await test.step('Then Finish is disabled', async () => {
      await expect(calibration.finishButton).toBeDisabled();
    });
  });
});
