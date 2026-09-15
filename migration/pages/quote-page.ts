import { type Locator } from '@playwright/test';
import { BasePage } from '../src/pages/base-page';

export class QuotePage extends BasePage {
  private readonly editQuoteLink: Locator;
  private readonly amendmentOpportunityLink: Locator;
  private readonly quotePageHeading: Locator;
  
  readonly quoteTotalField: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    
    this.editQuoteLink = page.getByRole('link', { name: 'Edit' });
    this.amendmentOpportunityLink = page.getByRole('link', { name: 'Opportunity' });
    this.quotePageHeading = page.getByRole('heading', { name: 'Quote' });
    this.quoteTotalField = page.locator('[data-testid="quote-total"]');
  }

  async navigateToEditQuote(): Promise<void> {
    await this.editQuoteLink.click();
  }

  async navigateToAmendmentOpportunity(): Promise<void> {
    await this.amendmentOpportunityLink.click();
  }

  getQuotePageHeading(): Locator {
    return this.quotePageHeading;
  }
}
