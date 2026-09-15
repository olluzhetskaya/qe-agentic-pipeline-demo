import { test, expect, Tags, testTimeouts, Users, Accounts, Opportunities } from '@fixtures';

test.describe('GCRM : Opportunity Creation', { tag: [Tags.gcrm, Tags.smoke] }, () => {
  test.setTimeout(testTimeouts.standard);

  test('should create a new opportunity for GCRM', async ({ login, accounts, opportunities }) => {
    const user = Users.salesUser;
    const account = Accounts.existingAccount;
    const opportunity = Opportunities.opportunityData;

    await test.step('Login as Sales user to GCRM', async () => {
      await login.goto(process.env.GCRM_URL || 'https://gcrm.example.com');
      await login.login(user.username, user.password);
      await expect(login.getHomeIndicator()).toBeVisible();
    });

    await test.step('Navigate to Account page', async () => {
      await accounts.goto(`/accounts/${account.name}`);
      await expect(accounts.accountDetailHeading).toContainText(account.name);
    });

    await test.step('Click on New Opportunity button', async () => {
      await opportunities.clickNewOpportunity();
      await expect(opportunities.newOpportunityFormHeading).toBeVisible();
    });

    await test.step('Fill in Opportunity required fields and save', async () => {
      await opportunities.fillOpportunityForm(opportunity.name, opportunity.stage, opportunity.closeDate);
      await opportunities.save();
      
      await expect(opportunities.getSuccessMessage()).toBeVisible();
      await expect(opportunities.getOpportunityDetailName()).toHaveText(opportunity.name);
    });
  });
});
