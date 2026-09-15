/**
 * Single import surface for migrated specs.
 *
 * Add each generated Page Object as an extended fixture here. Specs must not
 * import from `@playwright/test` or instantiate Page Objects directly.
 */
import { test as base } from '@playwright/test';
import { CalibrationPage } from '../pages/calibration-page';
import { LoginPage } from '../../pages/login-page';
import { AccountsPage } from '../../pages/accounts-page';
import { OpportunitiesPage } from '../../pages/opportunities-page';
import { QuotePage } from '../../pages/quote-page';
import { EditQuotePage } from '../../pages/edit-quote-page';
import { AmendmentOpportunityPage } from '../../pages/amendment-opportunity-page';
import { ManageInstallBasePage } from '../../pages/manage-install-base-page';

export { Tags, testTimeouts } from '@data/constants';
export { Users } from '@data/users';
export { Accounts } from '@data/accounts';
export { Opportunities } from '@data/opportunities';
export { Contracts } from '@data/contracts';
export { Products } from '@data/products';
export { AmendmentOpportunities, DiabetesLineEdits } from '@data/amendments';
export { expect } from '@playwright/test';

type MigrationFixtures = {
  calibration: CalibrationPage;
  login: LoginPage;
  accounts: AccountsPage;
  opportunities: OpportunitiesPage;
  quote: QuotePage;
  editQuote: EditQuotePage;
  amendmentOpportunity: AmendmentOpportunityPage;
  manageInstallBase: ManageInstallBasePage;
};

export const test = base.extend<MigrationFixtures>({
  calibration: async ({ page }, use) => {
    await use(new CalibrationPage(page));
  },
  login: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  accounts: async ({ page }, use) => {
    await use(new AccountsPage(page));
  },
  opportunities: async ({ page }, use) => {
    await use(new OpportunitiesPage(page));
  },
  quote: async ({ page }, use) => {
    await use(new QuotePage(page));
  },
  editQuote: async ({ page }, use) => {
    await use(new EditQuotePage(page));
  },
  amendmentOpportunity: async ({ page }, use) => {
    await use(new AmendmentOpportunityPage(page));
  },
  manageInstallBase: async ({ page }, use) => {
    await use(new ManageInstallBasePage(page));
  },
});
