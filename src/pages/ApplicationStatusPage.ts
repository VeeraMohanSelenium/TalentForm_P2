import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';

export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  raw: string;
}

/**
 * Application status and history. Covers WF-V06, WF-V07.
 * Locators verified against the live DOM on 2026-09-17.
 */
export class ApplicationStatusPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/status`;
  }

  /** The canonical lifecycle, for validating transition sequences (R-WF-07). */
  static readonly LIFECYCLE = [
    'Draft',
    'In Progress',
    'Pending Validation',
    'Submitted',
    'Under Review',
    'Requires Info',
    'Approved',
    'Rejected',
  ] as const;

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly referenceNumber: Locator;
  readonly currentStatus: Locator;
  readonly historyTable: Locator;
  readonly emptyState: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('status-page');
    this.referenceNumber = page.getByTestId('status-reference-number');
    this.currentStatus = page.getByTestId('status-current-value');
    this.historyTable = page.getByTestId('status-history-table');
    this.emptyState = page.getByTestId('status-empty-state');
  }

  get historyRows(): Locator {
    return this.historyTable.locator('tbody tr');
  }

  /**
   * Editable controls anywhere on the application. Must be zero once submitted
   * (R-WF-04). Navigation selects in the layout are excluded.
   */
  get editableFields(): Locator {
    return this.page.locator(
      'form input:not([type="hidden"]):not([disabled]):not([readonly]), ' +
        'form select:not([disabled]), form textarea:not([disabled]):not([readonly])',
    );
  }

  // --- QUERIES --------------------------------------------------------------

  async status(): Promise<string> {
    if (!(await this.isVisible(this.currentStatus))) return '';
    const text = ((await this.currentStatus.textContent()) ?? '').trim();
    const match = text.match(
      /\b(Draft|In Progress|Pending Validation|Submitted|Under Review|Requires Info|Approved|Rejected)\b/i,
    );
    return match ? match[1] : text;
  }

  async reference(): Promise<string> {
    if (!(await this.isVisible(this.referenceNumber))) return '';
    return ((await this.referenceNumber.textContent()) ?? '').trim();
  }

  async history(): Promise<StatusHistoryEntry[]> {
    if (!(await this.isVisible(this.historyTable))) return [];
    const count = await this.historyRows.count();
    const out: StatusHistoryEntry[] = [];
    for (let i = 0; i < count; i += 1) {
      const raw = ((await this.historyRows.nth(i).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      if (!raw) continue;
      out.push({
        status:
          raw.match(
            /\b(Draft|In Progress|Pending Validation|Submitted|Under Review|Requires Info|Approved|Rejected)\b/i,
          )?.[1] ?? '',
        timestamp: raw.match(/\d{4}-\d{2}-\d{2}[T ]?[\d:]*/)?.[0] ?? '',
        raw,
      });
    }
    return out;
  }

  async isHistorySequenceValid(): Promise<boolean> {
    const order = ApplicationStatusPage.LIFECYCLE.map((s) => s.toLowerCase());
    const seen = (await this.history())
      .map((h) => h.status.toLowerCase())
      .filter((s) => s.length > 0)
      .map((s) => order.indexOf(s));
    if (seen.length === 0) return true;
    if (seen.some((i) => i === -1)) return false;
    return seen.every((v, i) => i === 0 || v >= seen[i - 1]);
  }

  async editableFieldCount(): Promise<number> {
    return this.editableFields.count();
  }

  async isReadOnly(): Promise<boolean> {
    return (await this.editableFieldCount()) === 0;
  }
}
