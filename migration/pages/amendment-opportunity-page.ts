import { type Locator } from '@playwright/test';
import { BasePage } from '../src/pages/base-page';

export class AmendmentOpportunityPage extends BasePage {
  private readonly subtypeField: Locator;
  private readonly numberOfLivesField: Locator;
  private readonly subTypeDetailField: Locator;
  private readonly quoteLink: Locator;
  
  readonly opportunityPageHeading: Locator;
  readonly subTypeDetailDisplay: Locator;
  readonly bookingsTotalDisplay: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    
    this.subtypeField = page.getByLabel('Subtype');
    this.numberOfLivesField = page.getByLabel('Number of Lives');
    this.subTypeDetailField = page.getByLabel('Sub-Type Detail');
    this.quoteLink = page.getByRole('link', { name: 'Quote' });
    
    this.opportunityPageHeading = page.getByRole('heading', { name: 'Opportunity' });
    this.subTypeDetailDisplay = page.locator('[data-field="sub-type-detail"]');
    this.bookingsTotalDisplay = page.locator('[data-field="bookings-total"]');
  }

  async updateSubtype(value: string): Promise<void> {
    await this.subtypeField.selectOption(value);
  }

  async updateNumberOfLives(value: string): Promise<void> {
    await this.numberOfLivesField.fill(value);
  }

  async updateSubTypeDetail(value: string): Promise<void> {
    await this.subTypeDetailField.selectOption(value);
  }

  async navigateToQuote(): Promise<void> {
    await this.quoteLink.click();
  }
}
