import { type Locator } from '@playwright/test';
import { BasePage } from '../src/pages/base-page';

export class EditQuotePage extends BasePage {
  private readonly exitButton: Locator;
  private readonly addProductsButton: Locator;
  private readonly productSearch: Locator;
  private readonly reasonForApprovalInput: Locator;
  private readonly saveButton: Locator;
  private readonly submitForApprovalButton: Locator;
  
  readonly editQuotePageHeading: Locator;
  readonly quoteTotal: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    
    this.exitButton = page.getByRole('button', { name: 'Exit' });
    this.addProductsButton = page.getByRole('button', { name: 'Add Products' });
    this.productSearch = page.getByLabel('Search Products');
    this.reasonForApprovalInput = page.getByLabel('Reason for Approval');
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.submitForApprovalButton = page.getByRole('button', { name: 'Submit for Approval' });
    
    this.editQuotePageHeading = page.getByRole('heading', { name: 'Edit Quote' });
    this.quoteTotal = page.locator('[data-testid="quote-total"]');
  }

  async exitToQuotePage(): Promise<void> {
    await this.exitButton.click();
  }

  async addProduct(productName: string): Promise<void> {
    await this.addProductsButton.click();
    await this.productSearch.fill(productName);
    await this.page.getByRole('option', { name: productName }).click();
    await this.page.getByRole('button', { name: 'Add' }).click();
  }

  async editProductLine(productName: string, lineType: 'new' | 'existing'): Promise<void> {
    const lineSelector = lineType === 'new' ? `[data-line-type="new"][data-product="${productName}"]` : `[data-line-type="existing"][data-product="${productName}"]`;
    await this.page.locator(lineSelector).getByRole('button', { name: 'Edit' }).click();
  }

  async updatePerUnitDiscount(value: string): Promise<void> {
    await this.page.getByLabel('Per Unit Discount').fill(value);
    await this.page.getByRole('button', { name: 'Save Line' }).click();
  }

  async saveWithReasonForApproval(reason: string): Promise<void> {
    await this.reasonForApprovalInput.fill(reason);
    await this.saveButton.click();
  }

  async submitForApproval(): Promise<void> {
    await this.submitForApprovalButton.click();
  }

  getNetARRField(productName: string, lineType: 'new' | 'existing'): Locator {
    const lineSelector = lineType === 'new' ? `[data-line-type="new"][data-product="${productName}"]` : `[data-line-type="existing"][data-product="${productName}"]`;
    return this.page.locator(lineSelector).locator('[data-field="net-arr"]');
  }

  getParticipantQuantityField(productName: string, lineType: 'new' | 'existing'): Locator {
    const lineSelector = lineType === 'new' ? `[data-line-type="new"][data-product="${productName}"]` : `[data-line-type="existing"][data-product="${productName}"]`;
    return this.page.locator(lineSelector).locator('[data-field="participant-quantity"]');
  }

  getQuantityField(productName: string, lineType: 'new' | 'existing'): Locator {
    const lineSelector = lineType === 'new' ? `[data-line-type="new"][data-product="${productName}"]` : `[data-line-type="existing"][data-product="${productName}"]`;
    return this.page.locator(lineSelector).locator('[data-field="quantity"]');
  }

  getSubscriptionFeeField(productName: string, lineType: 'new' | 'existing'): Locator {
    const lineSelector = lineType === 'new' ? `[data-line-type="new"][data-product="${productName}"]` : `[data-line-type="existing"][data-product="${productName}"]`;
    return this.page.locator(lineSelector).locator('[data-field="subscription-fee"]');
  }
}
