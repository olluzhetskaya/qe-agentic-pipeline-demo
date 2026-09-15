import { type Locator } from '@playwright/test';
import { BasePage } from '../src/pages/base-page';

export class ManageInstallBasePage extends BasePage {
  private readonly contractTypeDropdown: Locator;
  private readonly amendmentTypeDropdown: Locator;
  private readonly proceedButton: Locator;
  
  readonly manageInstallBaseDialog: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    
    this.contractTypeDropdown = page.getByLabel('Contract Type');
    this.amendmentTypeDropdown = page.getByLabel('Amendment Type');
    this.proceedButton = page.getByRole('button', { name: 'Proceed' });
    
    this.manageInstallBaseDialog = page.getByRole('dialog', { name: 'Manage Install Base' });
  }

  async selectContractTypeAndAmend(contractType: string, amendmentType: string): Promise<void> {
    await this.contractTypeDropdown.selectOption(contractType);
    await this.amendmentTypeDropdown.selectOption(amendmentType);
    await this.proceedButton.click();
  }
}
