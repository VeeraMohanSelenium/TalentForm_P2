import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { ClientData } from '../utils/dataGenerator';
import { selectOption, submitAndWait } from '../utils/testHelpers';

/**
 * Client / insured information. Covers CLI-V01 to CLI-V05.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * Note: this page has no calculated-age display. Age is shown on the review
 * screen (`review-client-calculated-age`), so TC-CLI-008 asserts it there.
 */
export class ClientInformationPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/client`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly form: Locator;
  readonly firstName: Locator;
  readonly middleName: Locator;
  readonly lastName: Locator;
  readonly dob: Locator;
  readonly gender: Locator;
  readonly maritalStatus: Locator;
  readonly nationality: Locator;
  readonly occupation: Locator;
  readonly employerName: Locator;
  readonly employerAddress: Locator;
  readonly saveContinue: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('client-information-page');
    this.form = page.getByTestId('client-information-form');
    this.firstName = page.getByTestId('client-first-name-input');
    this.middleName = page.getByTestId('client-middle-name-input');
    this.lastName = page.getByTestId('client-last-name-input');
    this.dob = page.getByTestId('client-dob-input');
    this.gender = page.getByTestId('client-gender-select');
    this.maritalStatus = page.getByTestId('client-marital-status-select');
    this.nationality = page.getByTestId('client-nationality-input');
    this.occupation = page.getByTestId('client-occupation-input');
    this.employerName = page.getByTestId('client-employer-name-input');
    this.employerAddress = page.getByTestId('client-employer-address-input');
    this.saveContinue = page.getByTestId('client-save-continue-button');
  }

  /** Back-compat alias. */
  get employer(): Locator {
    return this.employerName;
  }

  protected get continueButton(): Locator {
    return this.saveContinue;
  }

  // --- ACTIONS --------------------------------------------------------------

  async fillPersonalDetails(client: ClientData): Promise<void> {
    await this.firstName.fill(client.firstName);
    await this.lastName.fill(client.lastName);
    await this.dob.fill(client.dob);
    await selectOption(this.gender, client.gender).catch(() => undefined);
    await selectOption(this.maritalStatus, client.maritalStatus).catch(() => undefined);
    await this.nationality.fill(client.nationality);
    await this.occupation.fill(client.occupation);
    await this.employerName.fill(client.employer);
    await this.employerAddress.fill('1 Corporate Plaza, Austin, TX 73301');
  }

  async setDateOfBirth(dob: string): Promise<void> {
    await this.dob.fill(dob);
    await this.dob.blur();
  }

  async completeWith(client: ClientData): Promise<void> {
    await this.fillPersonalDetails(client);
    await this.continue();
  }

  async continue(): Promise<void> {
    await submitAndWait(this.page, this.saveContinue);
  }

  async clearAllFields(): Promise<void> {
    for (const field of [
      this.firstName,
      this.middleName,
      this.lastName,
      this.dob,
      this.nationality,
      this.occupation,
      this.employerName,
    ]) {
      await field.fill('').catch(() => undefined);
    }
  }

  // --- QUERIES --------------------------------------------------------------

  /** This page does not display a calculated age; see ReviewPage.calculatedAge(). */
  async displayedAge(): Promise<number | null> {
    return null;
  }

  async hasDobError(): Promise<boolean> {
    if (await this.hasValidationError(/birth|age|dob|eligib|18|65/i)) return true;
    // HTML5 constraint validation blocks submission without rendering a message.
    const native = await this.dob
      .evaluate((el) => (el as HTMLInputElement).validationMessage)
      .catch(() => '');
    if (native) return true;
    // Still on the client step means progression was refused.
    return /\/client/.test(this.page.url()) && (await this.hasValidationError());
  }

  async dobErrorText(): Promise<string> {
    const messages = await this.validationMessages();
    return messages.find((m) => /birth|age|dob|eligib/i.test(m)) ?? messages[0] ?? '';
  }

  async readValues(): Promise<Partial<ClientData>> {
    return {
      firstName: await this.firstName.inputValue().catch(() => ''),
      lastName: await this.lastName.inputValue().catch(() => ''),
      dob: await this.dob.inputValue().catch(() => ''),
      occupation: await this.occupation.inputValue().catch(() => ''),
      employer: await this.employerName.inputValue().catch(() => ''),
    };
  }
}
