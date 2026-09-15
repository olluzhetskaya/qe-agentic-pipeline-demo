import { type Locator } from '@playwright/test';
import { BasePage } from '../src/pages/base-page';

export class LoginPage extends BasePage {
  private readonly usernameInput: Locator;
  private readonly passwordInput: Locator;
  private readonly loginButton: Locator;
  private readonly homeIndicator: Locator;

  constructor(page: import('@playwright/test').Page) {
    super(page);
    
    this.usernameInput = page.getByLabel('Username');
    this.passwordInput = page.getByLabel('Password');
    this.loginButton = page.getByRole('button', { name: 'Log In' });
    this.homeIndicator = page.getByRole('banner');
  }

  async login(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  getHomeIndicator(): Locator {
    return this.homeIndicator;
  }
}
