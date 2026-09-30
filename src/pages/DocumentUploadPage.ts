import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { Fixture } from '../utils/fileUploadHelper';
import { selectOption, submitAndWait, waitForIdle } from '../utils/testHelpers';

/**
 * Document upload. Covers DOC-V01 to DOC-V04.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * Note the `document-file-name-input` field, placeholder "simulated-upload.pdf".
 * This build lets the file NAME be supplied independently of the file itself,
 * which is worth probing: if validation reads that field rather than the upload,
 * a disallowed file could pass by simply typing an allowed name (R-DOC-01).
 */
export class DocumentUploadPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/documents`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly documentTypeSelect: Locator;
  readonly fileInput: Locator;
  readonly fileNameInput: Locator;
  readonly uploadButton: Locator;
  readonly documentsTable: Locator;
  readonly emptyState: Locator;
  readonly continueToReview: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('documents-page');
    this.documentTypeSelect = page.getByTestId('document-type-select');
    this.fileInput = page.getByTestId('document-upload-kyc');
    this.fileNameInput = page.getByTestId('document-file-name-input');
    this.uploadButton = page.getByTestId('document-upload-button');
    this.documentsTable = page.getByTestId('documents-table');
    this.emptyState = page.getByTestId('documents-empty-state');
    this.continueToReview = page.getByTestId('documents-continue-review-button');
  }

  get uploadedRows(): Locator {
    return this.documentsTable.locator('tbody tr');
  }
  get uploadError(): Locator {
    return this.page.getByRole('alert').first();
  }
  get requiredDocumentList(): Locator {
    return this.page.getByTestId('documents-required-list');
  }

  protected get continueButton(): Locator {
    return this.continueToReview;
  }

  // --- ACTIONS --------------------------------------------------------------

  async selectFile(fixture: Fixture): Promise<void> {
    await this.fileInput.setInputFiles({
      name: fixture.name,
      mimeType: fixture.mimeType,
      buffer: fixture.buffer,
    });
  }

  /**
   * Upload one document.
   * `fileNameOverride` types a different name into `document-file-name-input`
   * than the real file's, to probe whether validation trusts that field.
   */
  async upload(
    fixture: Fixture,
    documentType?: string,
    fileNameOverride?: string,
  ): Promise<void> {
    if (documentType) {
      await selectOption(this.documentTypeSelect, documentType).catch(() => undefined);
    }
    await this.selectFile(fixture);
    if ((await this.fileNameInput.count()) > 0) {
      await this.fileNameInput.fill(fileNameOverride ?? fixture.name);
    }
    await this.uploadButton.click();
    await waitForIdle(this.page);
  }

  /** Picks whatever the first real document type option is. */
  async selectFirstDocumentType(): Promise<string> {
    const options = await this.documentTypeSelect.locator('option').all();
    for (const option of options) {
      const value = await option.getAttribute('value');
      if (value && value !== '') {
        await this.documentTypeSelect.selectOption(value);
        return ((await option.textContent()) ?? '').trim();
      }
    }
    return '';
  }

  async removeDocument(name: string): Promise<void> {
    await this.rowFor(name).getByRole('button', { name: /remove|delete/i }).first().click();
    await waitForIdle(this.page);
  }

  async continue(): Promise<void> {
    await submitAndWait(this.page, this.continueToReview);
  }

  // --- QUERIES --------------------------------------------------------------

  rowFor(fileName: string): Locator {
    return this.uploadedRows.filter({ hasText: fileName }).first();
  }

  async uploadedCount(): Promise<number> {
    if (await this.isVisible(this.emptyState)) return 0;
    return this.uploadedRows.count();
  }

  async isUploaded(fileName: string): Promise<boolean> {
    return (await this.uploadedRows.filter({ hasText: fileName }).count()) > 0;
  }

  async uploadedFileNames(): Promise<string[]> {
    if (await this.isVisible(this.emptyState)) return [];
    const count = await this.uploadedRows.count();
    const out: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const text = ((await this.uploadedRows.nth(i).textContent()) ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) out.push(text);
    }
    return out;
  }

  async documentTypeOptions(): Promise<string[]> {
    return this.documentTypeSelect.locator('option').allTextContents();
  }

  async uploadErrorText(): Promise<string> {
    const messages = await this.validationMessages();
    return messages[0] ?? '';
  }

  async hasUploadError(): Promise<boolean> {
    return this.hasValidationError(/file|type|format|size|upload|not (support|allow)|invalid/i);
  }

  async hasSizeError(): Promise<boolean> {
    return this.hasValidationError(/size|large|exceed|limit|mb|kilobyte|megabyte/i);
  }

  async hasTypeError(): Promise<boolean> {
    return this.hasValidationError(/type|format|extension|not (support|allow)|invalid file|mime/i);
  }

  async outstandingRequiredDocuments(): Promise<string[]> {
    if (!(await this.isVisible(this.requiredDocumentList))) return [];
    const text = (await this.requiredDocumentList.textContent()) ?? '';
    return text.split('\n').map((l) => l.trim()).filter(Boolean);
  }
}
