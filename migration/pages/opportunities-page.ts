import { type Locator } from '@playwright/test';
import { BasePage } from '../src/pages/base-page';

export class OpportunitiesPage extends BasePage {
  private readonly newOpportunityButton: Locator;
  private readonly opportunityNameInput: Locator;
  private readonly stageSelect: Locator;
  private readonly closeDateInput: Locator;
  private readonly saveButton: Locator;
  private readonly successMessage: Locator;
  private readonly opportunityDetailName: Locator;
  
  // Public readonly Locators for assertions in specs
  readonly newOpportunityFormHeading: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    
    this.newOpportunityButton = page.getByRole('button', { name: 'New Opportunity' });
    this.opportunityNameInput = page.getByLabel('Opportunity Name');
    this.stageSelect = page.getByLabel('Stage');
    this.closeDateInput = page.getByLabel('Close Date');
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.successMessage = page.getByText('Opportunity created successfully');
    this.opportunityDetailName = page.locator('[data-testid="opportunity-name"]');
    
    this.newOpportunityFormHeading = page.getByRole('heading', { name: 'New Opportunity' });
  }

  async clickNewOpportunity(): Promise<void> {
    await this.newOpportunityButton.click();
  }

  async fillOpportunityForm(name: string, stage?: string, closeDate?: string): Promise<void> {
    await this.opportunityNameInput.fill(name);
    if (stage) {
      await this.stageSelect.selectOption(stage);
    }
    if (closeDate) {
      await this.closeDateInput.fill(closeDate);
    }
  }

  async save(): Promise<void> {
    await this.saveButton.click();
  }

  getSuccessMessage(): Locator {
    return this.successMessage;
  }

  getOpportunityDetailName(): Locator {
    return this.opportunityDetailName;
  }
}
