import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';

/**
 * Submission confirmation. Covers WF-V03, WF-V05.
 * Locators verified against the live DOM on 2026-09-17.
 */
export class ConfirmationPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/confirmation`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly referenceNumber: Locator;
  readonly viewStatusLink: Locator;
  readonly dashboardLink: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('submission-confirmation-page');
    this.referenceNumber = page.getByTestId('confirmation-reference-number');
    this.viewStatusLink = page.getByTestId('confirmation-view-status-link');
    this.dashboardLink = page.getByTestId('confirmation-dashboard-link');
  }

  get successMessage(): Locator {
    return this.root;
  }

  // --- QUERIES --------------------------------------------------------------

  async isVisibleConfirmation(): Promise<boolean> {
    return this.isVisible(this.root);
  }

  async confirmationText(): Promise<string> {
    if (!(await this.isVisible(this.root))) return '';
    return ((await this.root.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * The reference issued on submission.
   * Returns null when none is displayed, which is itself the finding for R-WF-06.
   */
  async reference(): Promise<string | null> {
    if (!(await this.isVisible(this.referenceNumber))) return null;
    const text = ((await this.referenceNumber.textContent()) ?? '').trim();
    const match = text.match(/([A-Z0-9][A-Z0-9-]{5,})/);
    return match ? match[1] : text || null;
  }

  async goToDashboard(): Promise<void> {
    await this.dashboardLink.click();
    await this.page.waitForURL(/\/dashboard/);
  }

  async goToStatus(): Promise<void> {
    await this.viewStatusLink.click();
    await this.page.waitForURL(/\/status/);
  }
}
