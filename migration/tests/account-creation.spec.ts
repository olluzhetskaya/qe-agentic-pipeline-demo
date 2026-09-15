import { test, expect, Tags, testTimeouts, Users, Accounts } from '@fixtures';

test.describe('GCRM : Account Creation', { tag: [Tags.gcrm, Tags.smoke] }, () => {
  test.setTimeout(testTimeouts.standard);

  test('should create a new account for GCRM', async ({ login, accounts }) => {
    const user = Users.salesUser;
    const account = Accounts.accountData;

    await test.step('Login as Sales user to GCRM', async () => {
      await login.goto(process.env.GCRM_URL || 'https://gcrm.example.com');
      await login.login(user.username, user.password);
      await expect(login.getHomeIndicator()).toBeVisible();
    });

    await test.step('Navigate to Accounts page from Home page', async () => {
      await accounts.goto('/accounts');
      await expect(accounts.page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
    });

    await test.step('Click New button on Accounts page', async () => {
      await accounts.clickNew();
      await expect(accounts.page.getByRole('heading', { name: 'New Account' })).toBeVisible();
    });

    await test.step('Fill in required fields on New account page and save', async () => {
      await accounts.fillAccountForm(account.name, account.type, account.industry);
      await accounts.save();
      
      await expect(accounts.getSuccessMessage()).toBeVisible();
      await expect(accounts.getAccountDetailName()).toHaveText(account.name);
    });
  });
});
