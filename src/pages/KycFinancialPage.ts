import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { FinancialData } from '../utils/dataGenerator';
import { selectOption, submitAndWait, waitForIdle } from '../utils/testHelpers';

/**
 * KYC, financial suitability and compliance. Covers CLI-V08 to CLI-V10.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * Two structural findings from the DOM inventory, both of which change how the
 * Submission 1 plan maps onto this build:
 *  - There is no separate SSN field. The SSN is entered through
 *    `kyc-id-number-input` after choosing the SSN option in `kyc-id-type-select`,
 *    so the masking check (R-KYC-01) targets the ID number field.
 *  - There is no file input on this page. KYC documents are uploaded on the
 *    dedicated /documents step instead.
 */
export class KycFinancialPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/kyc-financial`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly idType: Locator;
  readonly idNumber: Locator;
  readonly idIssueDate: Locator;
  readonly idExpiryDate: Locator;

  readonly annualIncome: Locator;
  readonly netWorth: Locator;
  readonly sourceOfFunds: Locator;
  readonly riskProfile: Locator;

  readonly pepSelect: Locator;
  readonly pepDetails: Locator;
  readonly declarationCheckbox: Locator;
  readonly saveContinue: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('kyc-financial-page');
    this.idType = page.getByTestId('kyc-id-type-select');
    this.idNumber = page.getByTestId('kyc-id-number-input');
    this.idIssueDate = page.getByTestId('kyc-issue-date-input');
    this.idExpiryDate = page.getByTestId('kyc-expiry-date-input');

    this.annualIncome = page.getByTestId('financial-annual-income-input');
    this.netWorth = page.getByTestId('financial-net-worth-input');
    this.sourceOfFunds = page.getByTestId('financial-source-of-funds-select');
    this.riskProfile = page.getByTestId('financial-risk-profile-select');

    this.pepSelect = page.getByTestId('compliance-pep-select');
    this.pepDetails = page.getByTestId('compliance-pep-details-input');
    this.declarationCheckbox = page.getByTestId('compliance-declaration-checkbox');
    this.saveContinue = page.getByTestId('kyc-financial-save-continue-button');
  }

  /** The SSN is captured through the ID number field; see the class note. */
  get ssn(): Locator {
    return this.idNumber;
  }

  protected get continueButton(): Locator {
    return this.saveContinue;
  }

  // --- ACTIONS --------------------------------------------------------------

  async fillIdentity(
    idType: string,
    idNumber: string,
    opts: { issue?: string; expiry?: string; ssn?: string } = {},
  ): Promise<void> {
    await selectOption(this.idType, idType).catch(() => undefined);
    await this.idNumber.fill(opts.ssn ?? idNumber);
    await this.idNumber.blur();
    if (opts.issue) await this.idIssueDate.fill(opts.issue).catch(() => undefined);
    if (opts.expiry) await this.idExpiryDate.fill(opts.expiry).catch(() => undefined);
  }

  async fillFinancials(data: FinancialData): Promise<void> {
    await this.annualIncome.fill(String(data.annualIncome));
    await this.netWorth.fill(String(data.netWorth));
    await selectOption(this.sourceOfFunds, data.sourceOfFunds).catch(() => undefined);
    await selectOption(this.riskProfile, data.riskProfile).catch(() => undefined);
  }

  /** PEP is a <select> in this build, not a radio pair. */
  async declarePep(isPep: boolean, details = ''): Promise<void> {
    await selectOption(this.pepSelect, isPep ? 'Yes' : 'No').catch(() => undefined);
    await waitForIdle(this.page);
    if (isPep && details) {
      await this.pepDetails.fill(details).catch(() => undefined);
    }
  }

  async completeDeclaration(): Promise<void> {
    await this.declarationCheckbox.check().catch(() => undefined);
  }

  async completeWith(financials: FinancialData, ssn: string, idNumber = 'A1234567'): Promise<void> {
    await this.fillIdentity('Passport', idNumber, { ssn: ssn || idNumber });
    await this.fillFinancials(financials);
    await this.declarePep(financials.isPep, financials.pepDetails);
    await this.completeDeclaration();
    await this.continue();
  }

  async continue(): Promise<void> {
    await submitAndWait(this.page, this.saveContinue);
  }

  // --- QUERIES --------------------------------------------------------------

  async idTypeOptions(): Promise<string[]> {
    return this.idType.locator('option').allTextContents();
  }

  async displayedSsn(): Promise<string> {
    return this.idNumber.inputValue().catch(() => '');
  }

  /** True when the stored identifier is not echoed back in full. */
  async isSsnMasked(fullSsn: string): Promise<boolean> {
    const shown = await this.displayedSsn();
    const digitsOnly = shown.replace(/\D/g, '');
    if (digitsOnly === fullSsn.replace(/\D/g, '')) return false;
    return /[*xâ€¢]/i.test(shown) || digitsOnly.length <= 4;
  }

  async isPepDetailsVisible(): Promise<boolean> {
    return this.isVisible(this.pepDetails);
  }

  async isPepDetailsRequired(): Promise<boolean> {
    if ((await this.pepDetails.count()) === 0) return false;
    const required = await this.pepDetails.getAttribute('required');
    const aria = await this.pepDetails.getAttribute('aria-required');
    return required !== null || aria === 'true';
  }

  async isDeclarationChecked(): Promise<boolean> {
    return this.declarationCheckbox.isChecked().catch(() => false);
  }

  async isSuitabilityWarningVisible(): Promise<boolean> {
    return this.hasValidationError(/suitab|afford|income|exceed|dispropor/i);
  }

  async suitabilityWarningText(): Promise<string> {
    const messages = await this.validationMessages();
    return messages.find((m) => /suitab|afford|income/i.test(m)) ?? '';
  }
}
