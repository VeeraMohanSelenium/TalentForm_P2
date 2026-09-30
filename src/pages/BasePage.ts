import { Locator, Page } from '@playwright/test';
import { collectValidationMessages, isDisabled, isVisible, waitForIdle } from '../utils/testHelpers';

/**
 * Shared behaviour for every page object.
 *
 * Page objects expose intent-level methods and return values. They contain NO
 * assertions — that belongs in the tests, so a page object can be reused by a
 * positive and a negative test without fighting it
 * (Study and QA Plan, section 8.3).
 *
 * LOCATOR POLICY
 * --------------
 * Preference order is getByRole, getByLabel, getByTestId. XPath is not used.
 * The application DOM has not been inspected yet (question Q-11), so each page
 * object declares its locators in a single clearly marked block at the top.
 * When the real markup is confirmed during exploration, only that block changes.
 */
export abstract class BasePage {
  constructor(protected readonly page: Page) {}

  /**
   * Route this page object owns, relative to baseURL.
   *
   * Declared as an abstract GETTER, not a field. With ES2022 class fields a
   * `readonly path: string` declaration here would be emitted as a real field
   * definition and silently overwrite a subclass getter of the same name.
   */
  abstract get path(): string;

  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await waitForIdle(this.page);
  }

  url(): string {
    return this.page.url();
  }

  async title(): Promise<string> {
    return this.page.title();
  }

  /** A field label or test id, tried by label first then by test id. */
  protected field(label: string, testId: string): Locator {
    const byLabel = this.page.getByLabel(label, { exact: false });
    return byLabel.or(this.page.getByTestId(testId)).first();
  }

  /** A button, tried by accessible role first then by test id. */
  protected button(name: string | RegExp, testId: string): Locator {
    const byRole = this.page.getByRole('button', { name, exact: false });
    return byRole.or(this.page.getByTestId(testId)).first();
  }

  /** All visible validation messages currently on the page. */
  async validationMessages(): Promise<string[]> {
    return collectValidationMessages(this.page);
  }

  async hasValidationError(containing?: string | RegExp): Promise<boolean> {
    const messages = await this.validationMessages();
    if (!containing) return messages.length > 0;
    const test = typeof containing === 'string'
      ? (m: string) => m.toLowerCase().includes(containing.toLowerCase())
      : (m: string) => containing.test(m);
    return messages.some(test);
  }

  protected isVisible(locator: Locator): Promise<boolean> {
    return isVisible(locator);
  }

  protected isDisabled(locator: Locator): Promise<boolean> {
    return isDisabled(locator);
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await waitForIdle(this.page);
  }
}

/**
 * Shared behaviour for the step pages inside an application
 * (client, address, KYC, product, riders, beneficiaries, documents).
 */
export abstract class ApplicationStepPage extends BasePage {
  constructor(page: Page, protected readonly applicationId: string) {
    super(page);
  }

  protected get continueButton(): Locator {
    return this.button(/continue|next|save and continue/i, 'continue-button');
  }

  /** Workflow chrome present on every step page. */
  protected get workflowBackButton(): Locator {
    return this.page.getByTestId('workflow-back-button');
  }

  protected get workflowSummaryButton(): Locator {
    return this.page.getByTestId('workflow-summary-button');
  }

  protected get backButton(): Locator {
    return this.workflowBackButton;
  }

  /** Attempts to move to the next step. Does not assert success — the test does. */
  async continue(): Promise<void> {
    await this.continueButton.click();
    await waitForIdle(this.page);
  }

  /**
   * Persists the current step.
   *
   * This build has no separate "Save Draft" control: the application is created
   * as a draft up front by "Create Draft Application", and each step persists
   * through its own Save and Continue. So saving a draft is simply saving the
   * step. Tests that then navigate away are still exercising draft persistence.
   */
  async saveDraft(): Promise<void> {
    await this.continueButton.click();
    await waitForIdle(this.page);
  }

  /** Returns to the application summary without saving. */
  async goToSummary(): Promise<void> {
    await this.workflowSummaryButton.click();
    await waitForIdle(this.page);
  }

  async canContinue(): Promise<boolean> {
    return !(await this.isDisabled(this.continueButton));
  }
}
