import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { PolicyData } from '../utils/dataGenerator';
import { parseMoney } from '../utils/assertions';
import { selectFirstRealOption, selectOption, submitAndWait, waitForIdle } from '../utils/testHelpers';

/**
 * Product and policy configuration. Covers PROD-V03 to PROD-V07.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * `product-range-help` carries the permitted sum assured range for the selected
 * product, so the boundary tests read the real limits from the page rather than
 * assuming them.
 */
export class ProductConfigurationPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/product`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly productSelect: Locator;
  readonly faceValue: Locator;
  readonly premiumFrequency: Locator;
  readonly paymentTerm: Locator;
  readonly policyTerm: Locator;
  readonly premiumDisplay: Locator;
  readonly rangeHelp: Locator;
  readonly premiumPreviewHelp: Locator;
  readonly saveContinue: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('product-configuration-page');
    this.productSelect = page.getByTestId('product-select');
    this.faceValue = page.getByTestId('product-sum-assured-input');
    this.premiumFrequency = page.getByTestId('product-premium-frequency-select');
    this.paymentTerm = page.getByTestId('product-payment-term-select');
    this.policyTerm = page.getByTestId('product-coverage-term-select');
    this.premiumDisplay = page.getByTestId('product-current-total-premium');
    this.rangeHelp = page.getByTestId('product-range-help');
    this.premiumPreviewHelp = page.getByTestId('premium-preview-help');
    this.saveContinue = page.getByTestId('product-save-continue-button');
  }

  protected get continueButton(): Locator {
    return this.saveContinue;
  }

  // --- ACTIONS --------------------------------------------------------------

  async selectProduct(nameOrCode: string): Promise<void> {
    await selectOption(this.productSelect, nameOrCode);
    await waitForIdle(this.page);
  }

  /** Selects whichever product is first in the list and returns its label. */
  async selectFirstProduct(): Promise<string> {
    const options = await this.productSelect.locator('option').all();
    for (const option of options) {
      const value = await option.getAttribute('value');
      const label = ((await option.textContent()) ?? '').trim();
      if (value && value !== '') {
        await this.productSelect.selectOption(value);
        await waitForIdle(this.page);
        return label;
      }
    }
    throw new Error('The product select contains no selectable option.');
  }

  async setFaceValue(amount: number): Promise<void> {
    await this.faceValue.fill(String(amount));
    await this.faceValue.blur();
    await waitForIdle(this.page);
  }

  async setPremiumFrequency(frequency: string): Promise<void> {
    await selectOption(this.premiumFrequency, frequency);
    await waitForIdle(this.page);
  }

  async setPaymentTerm(term: string): Promise<void> {
    await selectOption(this.paymentTerm, term);
  }

  async setPolicyTerm(term: string): Promise<void> {
    await selectOption(this.policyTerm, term);
  }

  /**
   * Sets every field on the step.
   *
   * Payment term and coverage term both carry an empty placeholder option and
   * are required: leaving them unset makes the step fail validation silently,
   * and the application then reports "Insurance product must be selected" on
   * the review page rather than naming the missing term.
   */
  async configure(policy: PolicyData): Promise<void> {
    await this.selectProduct(policy.product);
    await this.setFaceValue(policy.faceValue);
    await this.setPremiumFrequency(policy.premiumFrequency).catch(() => undefined);
    await selectOption(this.paymentTerm, policy.paymentTerm).catch(() =>
      selectFirstRealOption(this.paymentTerm),
    );
    await selectOption(this.policyTerm, policy.policyTerm).catch(() =>
      selectFirstRealOption(this.policyTerm),
    );
  }

  async completeWith(policy: PolicyData): Promise<void> {
    await this.configure(policy);
    await this.continue();
  }

  async continue(): Promise<void> {
    await submitAndWait(this.page, this.saveContinue);
  }

  // --- QUERIES --------------------------------------------------------------

  async productOptions(): Promise<string[]> {
    return this.productSelect.locator('option').allTextContents();
  }

  async premium(): Promise<number> {
    if (!(await this.isVisible(this.premiumDisplay))) return NaN;
    return parseMoney(await this.premiumDisplay.textContent());
  }

  async premiumAround(change: () => Promise<void>): Promise<{ before: number; after: number }> {
    const before = await this.premium();
    await change();
    await waitForIdle(this.page);
    const after = await this.premium();
    return { before, after };
  }

  /**
   * The permitted sum assured range for the selected product, read from the help
   * text so the boundary tests use the application's own limits.
   */
  async sumAssuredRange(): Promise<{ min: number; max: number } | null> {
    if (!(await this.isVisible(this.rangeHelp))) return null;
    const text = (await this.rangeHelp.textContent()) ?? '';
    const numbers = (text.match(/[\d,]+(?:\.\d+)?/g) ?? [])
      .map((n) => Number(n.replace(/,/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (numbers.length < 2) return null;
    return { min: Math.min(...numbers), max: Math.max(...numbers) };
  }

  async rangeHelpText(): Promise<string> {
    if (!(await this.isVisible(this.rangeHelp))) return '';
    return ((await this.rangeHelp.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async hasFaceValueError(): Promise<boolean> {
    if (await this.hasValidationError(/sum assured|face value|minimum|maximum|range|between/i)) {
      return true;
    }
    const native = await this.faceValue
      .evaluate((el) => (el as HTMLInputElement).validationMessage)
      .catch(() => '');
    return native !== '';
  }

  async faceValueErrorText(): Promise<string> {
    const messages = await this.validationMessages();
    return messages.find((m) => /sum assured|face value|minimum|maximum/i.test(m)) ?? messages[0] ?? '';
  }

  async isSuitabilityWarningVisible(): Promise<boolean> {
    return this.hasValidationError(/suitab|risk profile|not recommended|afford/i);
  }

  async readConfiguration(): Promise<Partial<PolicyData>> {
    return {
      faceValue: Number(await this.faceValue.inputValue().catch(() => '0')),
      premiumFrequency: await this.premiumFrequency.inputValue().catch(() => ''),
      paymentTerm: await this.paymentTerm.inputValue().catch(() => ''),
      policyTerm: await this.policyTerm.inputValue().catch(() => ''),
    };
  }
}
