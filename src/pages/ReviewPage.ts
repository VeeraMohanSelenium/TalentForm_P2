import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { parseMoney } from '../utils/assertions';
import { waitForIdle } from '../utils/testHelpers';

export interface ValidationEntry {
  text: string;
  module: string;
}

/**
 * Review and submission. Covers VAL-V01 to VAL-V03, WF-V03.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * Validation is EXPLICIT in this build: `review-validate-button` ("Run
 * Validation") must be pressed to populate `review-validation-errors`. Tests
 * that inspect the validation summary therefore call runValidation() first —
 * and whether submit is correctly gated *before* validation has been run is
 * itself worth asserting (R-WF-01).
 */
export class ReviewPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/review`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly validateButton: Locator;
  readonly submitButton: Locator;
  readonly validationErrors: Locator;
  readonly validationAlert: Locator;
  readonly snapshot: Locator;
  readonly calculatedAge: Locator;
  readonly totalPremium: Locator;
  readonly reviewBackButton: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('review-page');
    this.validateButton = page.getByTestId('review-validate-button');
    this.submitButton = page.getByTestId('review-submit-application-button');
    this.validationErrors = page.getByTestId('review-validation-errors');
    this.validationAlert = page.getByTestId('validation-error-alert');
    this.snapshot = page.getByTestId('review-application-snapshot');
    this.calculatedAge = page.getByTestId('review-client-calculated-age');
    this.totalPremium = page.getByTestId('review-total-premium');
    this.reviewBackButton = page.getByTestId('review-back-button');
  }

  get validationSummary(): Locator {
    return this.validationErrors;
  }
  get validationEntries(): Locator {
    return this.validationErrors.locator('li, [data-validation-item], p');
  }
  get premiumDisplay(): Locator {
    return this.totalPremium;
  }
  get reviewSections(): Locator {
    return this.snapshot.locator('section, .card, tr');
  }

  // --- ACTIONS --------------------------------------------------------------

  /** Presses "Run Validation" and waits for the outcome to render. */
  async runValidation(): Promise<void> {
    await this.validateButton.click();
    await waitForIdle(this.page);
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
    await waitForIdle(this.page);
  }

  /** Runs validation then submits — the ordinary agent path. */
  async validateAndSubmit(): Promise<void> {
    await this.runValidation();
    await this.submit();
  }

  async clickValidationEntry(containing: string | RegExp): Promise<void> {
    await this.validationEntries.filter({ hasText: containing }).first().click();
    await waitForIdle(this.page);
  }

  async editSection(sectionName: string): Promise<void> {
    await this.reviewSections
      .filter({ hasText: sectionName })
      .first()
      .getByRole('link', { name: /edit|change/i })
      .first()
      .click();
    await waitForIdle(this.page);
  }

  // --- QUERIES --------------------------------------------------------------

  async isSubmitEnabled(): Promise<boolean> {
    if ((await this.submitButton.count()) === 0) return false;
    return !(await this.isDisabled(this.submitButton));
  }

  async isSubmitPresent(): Promise<boolean> {
    return (await this.submitButton.count()) > 0;
  }

  async isValidationSummaryVisible(): Promise<boolean> {
    return (await this.isVisible(this.validationErrors)) || (await this.isVisible(this.validationAlert));
  }

  async validationEntryList(): Promise<ValidationEntry[]> {
    const scope = (await this.isVisible(this.validationErrors))
      ? this.validationErrors
      : this.validationAlert;
    if (!(await this.isVisible(scope))) return [];

    const items = scope.locator('li');
    const count = await items.count();
    const out: ValidationEntry[] = [];

    if (count > 0) {
      for (let i = 0; i < count; i += 1) {
        const text = ((await items.nth(i).textContent()) ?? '').replace(/\s+/g, ' ').trim();
        if (text) out.push({ text, module: ReviewPage.moduleFor(text) });
      }
      return out;
    }

    // No list markup: fall back to the block's own text.
    const text = ((await scope.textContent()) ?? '').replace(/\s+/g, ' ').trim();
    return text ? [{ text, module: ReviewPage.moduleFor(text) }] : [];
  }

  private static moduleFor(text: string): string {
    const t = text.toLowerCase();
    if (/beneficiar|allocation|guardian/.test(t)) return 'Beneficiaries';
    if (/document|upload|file/.test(t)) return 'Documents';
    if (/rider/.test(t)) return 'Riders';
    if (/product|premium|face value|sum assured/.test(t)) return 'Product';
    if (/ssn|kyc|pep|income|identification|declaration/.test(t)) return 'KYC';
    if (/address|zip|postal|state|email|phone/.test(t)) return 'Address';
    if (/name|birth|age|occupation|employer|client/.test(t)) return 'Client';
    return 'Other';
  }

  async validationEntryCount(): Promise<number> {
    return (await this.validationEntryList()).length;
  }

  async modulesWithErrors(): Promise<string[]> {
    return [...new Set((await this.validationEntryList()).map((e) => e.module))];
  }

  async premium(): Promise<number> {
    if (!(await this.isVisible(this.totalPremium))) return NaN;
    return parseMoney(await this.totalPremium.textContent());
  }

  /** The age the application derived from the entered date of birth (R-CLI-05). */
  async clientCalculatedAge(): Promise<number | null> {
    if (!(await this.isVisible(this.calculatedAge))) return null;
    const text = (await this.calculatedAge.textContent()) ?? '';
    const match = text.match(/(\d{1,3})/);
    return match ? Number(match[1]) : null;
  }

  async summaryText(): Promise<string> {
    const scope = (await this.isVisible(this.snapshot)) ? this.snapshot : this.page.locator('main, body').first();
    return ((await scope.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async containsValue(value: string): Promise<boolean> {
    return (await this.summaryText()).includes(value);
  }
}
