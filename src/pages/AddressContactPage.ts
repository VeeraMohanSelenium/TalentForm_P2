import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { AddressData } from '../utils/dataGenerator';
import { selectFirstRealOption, selectOption, submitAndWait, waitForIdle } from '../utils/testHelpers';

/**
 * Address and contact information. Covers CLI-V06, CLI-V07.
 * Locators verified against the live DOM on 2026-09-17.
 * State/province is a <select>, so values must be valid options.
 */
export class AddressContactPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/address-contact`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly resLine1: Locator;
  readonly resLine2: Locator;
  readonly resCity: Locator;
  readonly resState: Locator;
  readonly resZip: Locator;

  readonly sameAsResidential: Locator;

  readonly mailLine1: Locator;
  readonly mailLine2: Locator;
  readonly mailCity: Locator;
  readonly mailState: Locator;
  readonly mailZip: Locator;

  readonly email: Locator;
  readonly mobile: Locator;
  readonly alternatePhone: Locator;
  readonly preferredContact: Locator;
  readonly saveContinue: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('address-contact-page');
    this.resLine1 = page.getByTestId('residential-address-line-1-input');
    this.resLine2 = page.getByTestId('residential-address-line-2-input');
    this.resCity = page.getByTestId('residential-city-input');
    this.resState = page.getByTestId('residential-state-province-select');
    this.resZip = page.getByTestId('residential-postal-code-input');

    this.sameAsResidential = page.getByTestId('address-same-as-residential-checkbox');

    this.mailLine1 = page.getByTestId('mailing-address-line-1-input');
    this.mailLine2 = page.getByTestId('mailing-address-line-2-input');
    this.mailCity = page.getByTestId('mailing-city-input');
    this.mailState = page.getByTestId('mailing-state-province-select');
    this.mailZip = page.getByTestId('mailing-postal-code-input');

    this.email = page.getByTestId('contact-primary-email-input');
    this.mobile = page.getByTestId('contact-mobile-number-input');
    this.alternatePhone = page.getByTestId('contact-alternate-phone-input');
    this.preferredContact = page.getByTestId('contact-preferred-mode-select');
    this.saveContinue = page.getByTestId('address-contact-save-continue-button');
  }

  protected get continueButton(): Locator {
    return this.saveContinue;
  }

  // --- ACTIONS --------------------------------------------------------------

  async fillResidential(address: AddressData): Promise<void> {
    await this.resLine1.fill(address.line1);
    await this.resLine2.fill(address.line2);
    await this.resCity.fill(address.city);
    await selectOption(this.resState, address.state).catch(() => undefined);
    await this.resZip.fill(address.zip);
  }

  async fillMailing(address: AddressData): Promise<void> {
    await this.mailLine1.fill(address.line1);
    await this.mailLine2.fill(address.line2);
    await this.mailCity.fill(address.city);
    await selectOption(this.mailState, address.state).catch(() => undefined);
    await this.mailZip.fill(address.zip);
  }

  async fillContact(email: string, mobile: string, preferred = 'EMAIL'): Promise<void> {
    await this.email.fill(email);
    await this.mobile.fill(mobile);
    await this.alternatePhone.fill('3125551212').catch(() => undefined);
    await selectOption(this.preferredContact, preferred).catch(() =>
      selectFirstRealOption(this.preferredContact),
    );
  }

  async tickSameAsResidential(): Promise<void> {
    await this.sameAsResidential.check();
    await waitForIdle(this.page);
  }

  async untickSameAsResidential(): Promise<void> {
    await this.sameAsResidential.uncheck();
  }

  async completeWith(address: AddressData, email: string, mobile: string): Promise<void> {
    await this.fillResidential(address);
    await this.fillMailing(address);
    await this.fillContact(email, mobile);
    await this.continue();
  }

  async continue(): Promise<void> {
    await submitAndWait(this.page, this.saveContinue);
  }

  // --- QUERIES --------------------------------------------------------------

  async readResidential(): Promise<AddressData> {
    return {
      line1: await this.resLine1.inputValue().catch(() => ''),
      line2: await this.resLine2.inputValue().catch(() => ''),
      city: await this.resCity.inputValue().catch(() => ''),
      state: await this.resState.inputValue().catch(() => ''),
      zip: await this.resZip.inputValue().catch(() => ''),
    };
  }

  async readMailing(): Promise<AddressData> {
    return {
      line1: await this.mailLine1.inputValue().catch(() => ''),
      line2: await this.mailLine2.inputValue().catch(() => ''),
      city: await this.mailCity.inputValue().catch(() => ''),
      state: await this.mailState.inputValue().catch(() => ''),
      zip: await this.mailZip.inputValue().catch(() => ''),
    };
  }

  async isSameAsResidentialChecked(): Promise<boolean> {
    return this.sameAsResidential.isChecked().catch(() => false);
  }

  /** The state options the select actually offers, so test data stays valid. */
  async stateOptions(): Promise<string[]> {
    return this.resState.locator('option').allTextContents();
  }
}
