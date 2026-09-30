import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { applicationIdFromUrl, waitForIdle } from '../utils/testHelpers';

export interface ApplicationRow {
  /** The id embedded in the row's data-testid, e.g. "101". */
  id: string;
  /**
   * The application reference shown in the row, e.g. "WL2026090270739".
   * Falls back to the id when the row shows no reference (drafts have none yet).
   */
  reference: string;
  status: string;
  rowText: string;
}

/**
 * Agent dashboard. Covers DASH-V01 to DASH-V06.
 * Locators verified against the live DOM on 2026-09-17.
 */
export class DashboardPage extends BasePage {
  get path(): string {
    return '/dashboard';
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly newApplicationCta: Locator;
  readonly summaryDraft: Locator;
  readonly summarySubmitted: Locator;
  readonly summaryUnderReview: Locator;
  readonly summaryApproved: Locator;
  readonly summaryRequiresInfo: Locator;
  readonly applicationsTable: Locator;
  readonly applicationRows: Locator;
  readonly viewAllLink: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('dashboard-page');
    this.newApplicationCta = page.getByTestId('dashboard-new-application-button');
    this.summaryDraft = page.getByTestId('dashboard-summary-draft');
    this.summarySubmitted = page.getByTestId('dashboard-summary-submitted');
    this.summaryUnderReview = page.getByTestId('dashboard-summary-under-review');
    this.summaryApproved = page.getByTestId('dashboard-summary-approved');
    this.summaryRequiresInfo = page.getByTestId('dashboard-summary-requires-info');
    this.applicationsTable = page.getByTestId('dashboard-applications-table');
    this.applicationRows = page.locator('[data-testid^="application-row-"]');
    this.viewAllLink = page.getByTestId('dashboard-view-all-applications-link');
  }

  /** Back-compat aliases used by existing specs. */
  get draftSummary(): Locator {
    return this.summaryDraft;
  }
  get submittedSummary(): Locator {
    return this.summarySubmitted;
  }
  get emptyState(): Locator {
    return this.page.getByTestId('dashboard-empty-state');
  }
  get statusFilter(): Locator {
    return this.page.getByTestId('dashboard-status-filter');
  }
  get searchInput(): Locator {
    return this.page.getByRole('searchbox');
  }

  // --- ACTIONS --------------------------------------------------------------

  /**
   * Starts a new application and returns its ID.
   *
   * Two steps, not one: the dashboard button navigates to /applications/new,
   * which is a confirmation form. The draft only exists after
   * "Create Draft Application" is clicked, which redirects to
   * /applications/{id}/client.
   */
  async startNewApplication(): Promise<string> {
    await this.newApplicationCta.click();
    await this.page.waitForURL(/\/applications\/new/);
    await this.page.getByTestId('application-create-draft-button').click();
    await this.page.waitForURL(/\/applications\/\d+/);
    await waitForIdle(this.page);
    return applicationIdFromUrl(this.page.url());
  }

  async openApplication(id: string): Promise<string> {
    await this.page.getByTestId(`application-open-${id}`).click();
    await waitForIdle(this.page);
    return applicationIdFromUrl(this.page.url());
  }

  async openFirstApplication(): Promise<string> {
    await this.applicationRows.first().getByRole('link').first().click();
    await waitForIdle(this.page);
    return applicationIdFromUrl(this.page.url());
  }

  /** Back-compat: resume a draft by its id. */
  async resumeDraft(id: string): Promise<string> {
    return this.openApplication(id);
  }

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.selectOption({ label: status });
    await waitForIdle(this.page);
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await this.searchInput.press('Enter');
    await waitForIdle(this.page);
  }

  // --- QUERIES --------------------------------------------------------------

  rowFor(id: string): Locator {
    return this.page.getByTestId(`application-row-${id}`);
  }

  async rowCount(): Promise<number> {
    return this.applicationRows.count();
  }

  /** Every application visible to the signed-in agent. */
  async listApplications(): Promise<ApplicationRow[]> {
    const count = await this.applicationRows.count();
    const out: ApplicationRow[] = [];
    for (let i = 0; i < count; i += 1) {
      const row = this.applicationRows.nth(i);
      const testId = (await row.getAttribute('data-testid')) ?? '';
      const id = testId.replace('application-row-', '');
      const rowText = ((await row.textContent()) ?? '').replace(/\s+/g, ' ').trim();
      const statusCell = this.page.getByTestId(`application-status-${id}`);
      const status =
        (await statusCell.count()) > 0
          ? ((await statusCell.textContent()) ?? '').trim()
          : (rowText.match(
              /\b(Draft|In Progress|Pending Validation|Submitted|Under Review|Approved|Rejected|Requires Info)\b/i,
            )?.[0] ?? '');
      const reference = rowText.match(/\bWL[A-Z0-9]{6,}\b/)?.[0] ?? id;
      out.push({ id, reference, status, rowText });
    }
    return out;
  }

  async statusFor(id: string): Promise<string> {
    const cell = this.page.getByTestId(`application-status-${id}`);
    if ((await cell.count()) === 0) return '';
    return ((await cell.textContent()) ?? '').trim();
  }

  /** Reads a summary tile's numeric count, e.g. how many drafts exist. */
  async summaryCount(
    tile: 'draft' | 'submitted' | 'under-review' | 'approved' | 'requires-info',
  ): Promise<number> {
    const locator = this.page.getByTestId(`dashboard-summary-${tile}`);
    if ((await locator.count()) === 0) return NaN;
    const text = (await locator.textContent()) ?? '';
    const match = text.match(/(\d+)/);
    return match ? Number(match[1]) : NaN;
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return (await this.rowCount()) === 0;
  }

  async isLoaded(): Promise<boolean> {
    return (await this.isVisible(this.root)) && /\/dashboard/.test(this.page.url());
  }
}
