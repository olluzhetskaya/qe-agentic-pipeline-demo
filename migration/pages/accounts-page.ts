import { type Locator } from '@playwright/test';
import { BasePage } from '../src/pages/base-page';

export class AccountsPage extends BasePage {
  private readonly newButton: Locator;
  private readonly accountNameInput: Locator;
  private readonly accountTypeSelect: Locator;
  private readonly industrySelect: Locator;
  private readonly saveButton: Locator;
  private readonly successMessage: Locator;
  private readonly accountDetailName: Locator;
  
  // Public readonly Locators for assertions in specs
  readonly accountsPageHeading: Locator;
  readonly newAccountFormHeading: Locator;
  readonly accountDetailHeading: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    
    this.newButton = page.getByRole('button', { name: 'New' });
    this.accountNameInput = page.getByLabel('Account Name');
    this.accountTypeSelect = page.getByLabel('Type');
    this.industrySelect = page.getByLabel('Industry');
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.successMessage = page.getByText('Account created successfully');
    this.accountDetailName = page.locator('[data-testid="account-name"]');
    
    this.accountsPageHeading = page.getByRole('heading', { name: 'Accounts' });
    this.newAccountFormHeading = page.getByRole('heading', { name: 'New Account' });
    this.accountDetailHeading = page.getByRole('heading', { name: /^/ }); // Dynamic account name
  }

  async clickNew(): Promise<void> {
    await this.newButton.click();
  }

  async fillAccountForm(name: string, type?: string, industry?: string): Promise<void> {
    await this.accountNameInput.fill(name);
    if (type) {
      await this.accountTypeSelect.selectOption(type);
    }
    if (industry) {
      await this.industrySelect.selectOption(industry);
    }
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  getSuccessMessage(): Locator {
    return this.successMessage;
  }

  getAccountDetailName(): Locator {
    return this.accountDetailName;
  }
}
