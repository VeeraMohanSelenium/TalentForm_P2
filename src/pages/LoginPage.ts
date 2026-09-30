import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { waitForIdle } from '../utils/testHelpers';

/**
 * Login, logout and session checks. Covers AUTH-V01 to AUTH-V08.
 *
 * Locators verified against the live application on 2026-09-17 — see
 * `dom-inventory.md`. The app exposes data-testid throughout, so that is the
 * primary strategy (question Q-11 closed: yes, they exist).
 */
export class LoginPage extends BasePage {
  get path(): string {
    return '/login';
  }

  // --- LOCATORS (verified against the live DOM) -----------------------------
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly errorBanner: Locator;
  readonly forgotPasswordLink: Locator;
  readonly registerLink: Locator;
  readonly demoHint: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.email = page.getByTestId('login-email-input');
    this.password = page.getByTestId('login-password-input');
    this.submit = page.getByTestId('login-submit-button');
    this.errorBanner = page
      .getByRole('alert')
      .or(page.locator('.alert-danger, .invalid-feedback'))
      .first();
    this.forgotPasswordLink = page.getByTestId('forgot-password-link');
    this.registerLink = page.getByTestId('agent-registration-link');
    this.demoHint = page.getByTestId('login-demo-hint');
    this.logoutButton = page.getByTestId('nav-logout-button');
  }

  /** Back-compat alias: the field is an email address, not a username. */
  get username(): Locator {
    return this.email;
  }

  // --- ACTIONS --------------------------------------------------------------

  /** Fills and submits. Does not assert the outcome. */
  async login(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
    await waitForIdle(this.page);
  }

  /**
   * Navigate, log in, and land on the dashboard.
   *
   * The application redirects to /change-password after a successful login. That
   * redirect is NOT enforced — /dashboard is reachable without changing anything —
   * so this steps past it. The password is deliberately never changed: the demo
   * account is shared across learners and its password is printed on the login
   * page itself.
   */
  async open(email: string, password: string): Promise<void> {
    await this.goto();
    await this.login(email, password);
    if (/\/change-password/.test(this.page.url())) {
      await this.page.goto('/dashboard');
      await waitForIdle(this.page);
    }
  }

  async submitEmpty(): Promise<void> {
    await this.submit.click();
  }

  /** Repeats a failed login n times, for the lockout test (AUTH-V07 / R-AUTH-02). */
  async attemptFailedLogins(email: string, wrongPassword: string, times: number): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await this.goto();
      await this.login(email, wrongPassword);
    }
  }

  async logout(): Promise<void> {
    await this.logoutButton.click();
    await waitForIdle(this.page);
  }

  // --- QUERIES --------------------------------------------------------------

  async errorText(): Promise<string> {
    if (!(await this.isVisible(this.errorBanner))) return '';
    return ((await this.errorBanner.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async isOnLoginPage(): Promise<boolean> {
    return /\/login/.test(this.page.url());
  }

  /** HTML5 `required` blocks submission, so "field errors" are validity states. */
  async fieldErrors(): Promise<string[]> {
    const messages = await this.validationMessages();
    if (messages.length > 0) return messages;

    const native: string[] = [];
    for (const field of [this.email, this.password]) {
      const message = await field
        .evaluate((el) => (el as HTMLInputElement).validationMessage)
        .catch(() => '');
      if (message) native.push(message);
    }
    return native;
  }

  /** The demo credentials the application prints on its own login page. */
  async demoHintText(): Promise<string> {
    if (!(await this.isVisible(this.demoHint))) return '';
    return ((await this.demoHint.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }
}
