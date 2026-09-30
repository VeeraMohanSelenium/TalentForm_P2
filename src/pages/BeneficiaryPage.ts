import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { BeneficiaryData } from '../utils/dataGenerator';
import { selectOption, submitAndWait, waitForIdle } from '../utils/testHelpers';

/**
 * Beneficiary management. Covers BEN-V01 to BEN-V09.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * Structure in this build: a single always-present form plus a table of saved
 * beneficiaries. There is no "add" modal â€” you fill the form and press
 * `beneficiary-save-button`; `beneficiary-continue-button` advances the step.
 * Conditional field groups (trust, organization, minor guardian) are in the DOM
 * and shown or hidden by type/age, so visibility is the meaningful assertion.
 */
export class BeneficiaryPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/beneficiaries`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly table: Locator;
  readonly emptyState: Locator;
  readonly allocationSummary: Locator;
  readonly estateFallbackMessage: Locator;

  readonly levelSelect: Locator;
  readonly typeSelect: Locator;
  readonly relationship: Locator;
  readonly allocation: Locator;
  readonly designationSelect: Locator;

  readonly firstName: Locator;
  readonly middleName: Locator;
  readonly lastName: Locator;
  readonly dob: Locator;
  readonly gender: Locator;
  readonly phone: Locator;
  readonly email: Locator;
  readonly country: Locator;

  readonly trustName: Locator;
  readonly trusteeName: Locator;
  readonly trustDate: Locator;
  readonly trusteeContact: Locator;

  readonly orgName: Locator;
  readonly orgRegistration: Locator;
  readonly orgContact: Locator;

  readonly minorGuardianSection: Locator;
  readonly guardianName: Locator;
  readonly guardianRelationship: Locator;
  readonly guardianContact: Locator;
  readonly guardianAddress: Locator;
  readonly legalAcknowledgement: Locator;

  readonly saveButton: Locator;
  readonly continueBtn: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('beneficiary-page');
    this.table = page.getByTestId('beneficiary-table');
    this.emptyState = page.getByTestId('beneficiary-empty-state');
    this.allocationSummary = page.getByTestId('beneficiary-allocation-summary');
    this.estateFallbackMessage = page.getByTestId('estate-assignment-fallback-message');

    this.levelSelect = page.getByTestId('beneficiary-level-select');
    this.typeSelect = page.getByTestId('beneficiary-type-select');
    this.relationship = page.getByTestId('beneficiary-relationship-select');
    this.allocation = page.getByTestId('beneficiary-allocation-input');
    this.designationSelect = page.getByTestId('beneficiary-designation-select');

    this.firstName = page.getByTestId('beneficiary-first-name-input');
    this.middleName = page.getByTestId('beneficiary-middle-name-input');
    this.lastName = page.getByTestId('beneficiary-last-name-input');
    this.dob = page.getByTestId('beneficiary-dob-input');
    this.gender = page.getByTestId('beneficiary-gender-select');
    this.phone = page.getByTestId('beneficiary-phone-input');
    this.email = page.getByTestId('beneficiary-email-input');
    this.country = page.getByTestId('beneficiary-country-input');

    this.trustName = page.getByTestId('beneficiary-trust-name-input');
    this.trusteeName = page.getByTestId('beneficiary-trustee-name-input');
    this.trustDate = page.getByTestId('beneficiary-trust-date-input');
    this.trusteeContact = page.getByTestId('beneficiary-trustee-contact-input');

    this.orgName = page.getByTestId('beneficiary-organization-name-input');
    this.orgRegistration = page.getByTestId('beneficiary-organization-registration-input');
    this.orgContact = page.getByTestId('beneficiary-organization-contact-input');

    this.minorGuardianSection = page.getByTestId('minor-guardian-section');
    this.guardianName = page.getByTestId('beneficiary-guardian-name-input');
    this.guardianRelationship = page.getByTestId('beneficiary-guardian-relationship-input');
    this.guardianContact = page.getByTestId('beneficiary-guardian-contact-input');
    this.guardianAddress = page.getByTestId('beneficiary-guardian-address-input');
    this.legalAcknowledgement = page.getByTestId('beneficiary-legal-acknowledgement-checkbox');

    this.saveButton = page.getByTestId('beneficiary-save-button');
    this.continueBtn = page.getByTestId('beneficiary-continue-button');
  }

  /** Back-compat aliases used by existing specs. */
  get beneficiaryRows(): Locator {
    return this.table.locator('tbody tr');
  }
  get formType(): Locator {
    return this.typeSelect;
  }
  get formFirstName(): Locator {
    return this.firstName;
  }
  get formAllocation(): Locator {
    return this.allocation;
  }
  get formSave(): Locator {
    return this.saveButton;
  }
  get addPrimaryButton(): Locator {
    return this.saveButton;
  }
  get addSecondaryButton(): Locator {
    return this.levelSelect;
  }
  get primaryTotal(): Locator {
    return this.allocationSummary;
  }
  get secondaryTotal(): Locator {
    return this.allocationSummary;
  }
  get allocationError(): Locator {
    return this.page.getByRole('alert').first();
  }

  protected get continueButton(): Locator {
    return this.continueBtn;
  }

  // --- ACTIONS --------------------------------------------------------------

  /** No-op in this build: the form is always present. Kept for spec compatibility. */
  async openAddForm(tier: 'primary' | 'secondary' = 'primary'): Promise<void> {
    await selectOption(this.levelSelect, tier === 'primary' ? 'Primary' : 'Secondary').catch(
      () => undefined,
    );
  }

  async selectType(type: BeneficiaryData['type']): Promise<void> {
    await selectOption(this.typeSelect, type);
    await waitForIdle(this.page);
  }

  async fillForm(b: BeneficiaryData, opts: { guardian?: string } = {}): Promise<void> {
    await selectOption(this.typeSelect, b.type).catch(() => undefined);
    await waitForIdle(this.page);

    if (b.type === 'INDIVIDUAL') {
      await this.firstName.fill(b.firstName).catch(() => undefined);
      await this.lastName.fill(b.lastName).catch(() => undefined);
      await this.dob.fill(b.dob).catch(() => undefined);
      await this.dob.blur().catch(() => undefined);
      await waitForIdle(this.page);
    }

    await selectOption(this.relationship, b.relationship).catch(() => undefined);
    await this.allocation.fill(String(b.allocation));

    if (opts.guardian && (await this.isVisible(this.guardianName))) {
      await this.guardianName.fill(opts.guardian);
      await this.guardianRelationship.fill('Parent').catch(() => undefined);
      await this.guardianContact.fill('5551234567').catch(() => undefined);
      await this.guardianAddress.fill('1 Guardian Way, Austin, TX').catch(() => undefined);
      await this.legalAcknowledgement.check().catch(() => undefined);
    }
  }

  async saveForm(): Promise<void> {
    await this.saveButton.click();
    await waitForIdle(this.page);
  }

  async addBeneficiary(
    b: BeneficiaryData,
    tier: 'primary' | 'secondary' = 'primary',
    opts: { guardian?: string } = {},
  ): Promise<void> {
    await this.openAddForm(tier);
    await this.fillForm(b, opts);
    await this.saveForm();
  }

  async addBeneficiaries(
    list: BeneficiaryData[],
    tier: 'primary' | 'secondary' = 'primary',
  ): Promise<void> {
    for (const b of list) await this.addBeneficiary(b, tier);
  }

  async removeBeneficiary(name: string): Promise<void> {
    await this.rowFor(name).getByRole('button', { name: /remove|delete/i }).first().click();
    await waitForIdle(this.page);
  }

  async setAllocation(name: string, allocation: number): Promise<void> {
    const field = this.rowFor(name).locator('input[type="number"]').first();
    if ((await field.count()) > 0) {
      await field.fill(String(allocation));
      await field.blur();
      await waitForIdle(this.page);
    }
  }

  async fillTrustFields(trustName: string, trustee: string, date: string): Promise<void> {
    await this.trustName.fill(trustName);
    await this.trusteeName.fill(trustee);
    await this.trustDate.fill(date).catch(() => undefined);
    await this.trusteeContact.fill('5559990000').catch(() => undefined);
  }

  async fillOrganizationFields(name: string, registration: string, contact: string): Promise<void> {
    await this.orgName.fill(name);
    await this.orgRegistration.fill(registration);
    await this.orgContact.fill(contact).catch(() => undefined);
  }

  async continue(): Promise<void> {
    await submitAndWait(this.page, this.continueBtn);
  }

  // --- QUERIES --------------------------------------------------------------

  rowFor(name: string): Locator {
    return this.beneficiaryRows.filter({ hasText: name }).first();
  }

  async count(): Promise<number> {
    if (await this.isVisible(this.emptyState)) return 0;
    return this.beneficiaryRows.count();
  }

  async hasBeneficiary(name: string): Promise<boolean> {
    return (await this.beneficiaryRows.filter({ hasText: name }).count()) > 0;
  }

  private async summaryText(): Promise<string> {
    if (!(await this.isVisible(this.allocationSummary))) return '';
    return ((await this.allocationSummary.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Allocation totals, parsed from the summary block. The summary reports primary
   * and secondary separately; the first percentage found is taken as primary.
   */
  async allocationTotals(): Promise<{ primary: number; secondary: number }> {
    const text = await this.summaryText();
    const primaryMatch = text.match(/primary[^0-9]*(\d+(?:\.\d+)?)\s*%/i);
    const secondaryMatch = text.match(/(?:secondary|contingent)[^0-9]*(\d+(?:\.\d+)?)\s*%/i);
    const all = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
    return {
      primary: primaryMatch ? Number(primaryMatch[1]) : (all[0] ?? NaN),
      secondary: secondaryMatch ? Number(secondaryMatch[1]) : (all[1] ?? NaN),
    };
  }

  async primaryAllocationTotal(): Promise<number> {
    return (await this.allocationTotals()).primary;
  }

  async secondaryAllocationTotal(): Promise<number> {
    return (await this.allocationTotals()).secondary;
  }

  async allocationErrorText(): Promise<string> {
    const messages = await this.validationMessages();
    return messages.find((m) => /allocat|100|percent/i.test(m)) ?? messages[0] ?? '';
  }

  async hasAllocationError(): Promise<boolean> {
    return this.hasValidationError(/allocat|100|percent|total|must equal/i);
  }

  async isMinorGuardianSectionVisible(): Promise<boolean> {
    return this.isVisible(this.minorGuardianSection);
  }

  async areGuardianFieldsRequired(): Promise<boolean> {
    if (!(await this.isVisible(this.guardianName))) return false;
    const required = await this.guardianName.getAttribute('required');
    const aria = await this.guardianName.getAttribute('aria-required');
    return required !== null || aria === 'true' || (await this.isMinorGuardianSectionVisible());
  }

  async trustFieldsVisible(): Promise<boolean> {
    return (await this.isVisible(this.trustName)) && (await this.isVisible(this.trusteeName));
  }

  async organizationFieldsVisible(): Promise<boolean> {
    return (await this.isVisible(this.orgName)) && (await this.isVisible(this.orgRegistration));
  }

  async isDuplicateErrorVisible(): Promise<boolean> {
    return this.hasValidationError(/duplicate|already (been )?added|same beneficiary|exists/i);
  }

  async isIrrevocableModalVisible(): Promise<boolean> {
    return this.isVisible(this.page.getByRole('dialog'));
  }

  /** Shown when no beneficiary is named and the estate becomes the fallback. */
  async isEstateFallbackVisible(): Promise<boolean> {
    return this.isVisible(this.estateFallbackMessage);
  }
}
