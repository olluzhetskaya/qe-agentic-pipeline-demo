import { test, Tags } from '@fixtures';

// GOLDEN (migration, dirty): Gherkin Then was dropped. The spec only opens
// the wizard. ESLint may also fail expect-expect; the judge still owns
// "this is not the mapped Then."

test.describe('Migrated scenario with dropped Then', { tag: [Tags.smoke] }, () => {
  test('opens the wizard and stops', async ({ onboarding }) => {
    await test.step('Given the wizard is open', async () => {
      await onboarding.gotoWizard();
    });
  });
});
