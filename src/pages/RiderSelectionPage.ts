import { Locator, Page } from '@playwright/test';
import { ApplicationStepPage } from './BasePage';
import { parseMoney } from '../utils/assertions';
import { submitAndWait, waitForIdle } from '../utils/testHelpers';

export interface PremiumLine {
  label: string;
  amount: number;
}

export interface RiderRow {
  /** 1-based index used in the data-testid, e.g. rider-row-3. */
  index: number;
  name: string;
  rowText: string;
}

/**
 * Rider selection. Covers RIDER-V01 to RIDER-V07.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * Riders are a fixed table of nine rows addressed by 1-based INDEX
 * (`rider-row-N`, `rider-selected-N`, `rider-coverage-amount-N`), not by name.
 * `riderIndexByName()` resolves a display name to its index so the tests can
 * still be written in business terms.
 */
export class RiderSelectionPage extends ApplicationStepPage {
  get path(): string {
    return `/applications/${this.applicationId}/riders`;
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly riderRows: Locator;
  readonly premiumSummary: Locator;
  readonly saveContinue: Locator;

  constructor(page: Page, applicationId: string) {
    super(page, applicationId);
    this.root = page.getByTestId('riders-page');
    this.riderRows = page.locator('[data-testid^="rider-row-"]');
    this.premiumSummary = page.getByTestId('rider-premium-summary');
    this.saveContinue = page.getByTestId('rider-save-continue-button');
  }

  /** Back-compat alias. */
  get riderCards(): Locator {
    return this.riderRows;
  }
  get totalPremium(): Locator {
    return this.premiumSummary;
  }
  get premiumLines(): Locator {
    return this.premiumSummary.locator('li, tr, [data-premium-line]');
  }
  get healthQuestionnaire(): Locator {
    return this.page.getByTestId('rider-health-questionnaire');
  }
  get riderError(): Locator {
    return this.page.getByRole('alert').first();
  }

  protected get continueButton(): Locator {
    return this.saveContinue;
  }

  // --- helpers --------------------------------------------------------------

  row(index: number): Locator {
    return this.page.getByTestId(`rider-row-${index}`);
  }
  checkbox(index: number): Locator {
    return this.page.getByTestId(`rider-selected-${index}`);
  }
  coverage(index: number): Locator {
    return this.page.getByTestId(`rider-coverage-amount-${index}`);
  }

  /** Resolves a rider display name to its 1-based row index, or null. */
  async riderIndexByName(name: string): Promise<number | null> {
    const rows = await this.listRiders();
    const needle = name.toLowerCase();
    const hit =
      rows.find((r) => r.name.toLowerCase() === needle) ??
      rows.find((r) => r.rowText.toLowerCase().includes(needle));
    return hit ? hit.index : null;
  }

  private async requireIndex(name: string): Promise<number> {
    const index = await this.riderIndexByName(name);
    if (index === null) {
      const available = (await this.listRiders()).map((r) => r.name).join(', ');
      throw new Error(`No rider matching "${name}". Riders on this page: ${available}`);
    }
    return index;
  }

  // --- ACTIONS --------------------------------------------------------------

  async addRiderByIndex(index: number, coverage?: number): Promise<void> {
    await this.checkbox(index).check();
    if (coverage !== undefined) {
      await this.coverage(index).fill(String(coverage));
      await this.coverage(index).blur();
    }
    await waitForIdle(this.page);
  }

  async addRider(name: string, coverage?: number): Promise<void> {
    await this.addRiderByIndex(await this.requireIndex(name), coverage);
  }

  async removeRider(name: string): Promise<void> {
    await this.checkbox(await this.requireIndex(name)).uncheck();
    await waitForIdle(this.page);
  }

  async setRiderCoverage(name: string, coverage: number): Promise<void> {
    const index = await this.requireIndex(name);
    await this.coverage(index).fill(String(coverage));
    await this.coverage(index).blur();
    await waitForIdle(this.page);
  }

  /** Selects riders until `count` are ticked. Returns the names selected. */
  async addRidersUpTo(count: number): Promise<string[]> {
    const rows = await this.listRiders();
    const added: string[] = [];
    for (const r of rows) {
      if (added.length >= count) break;
      const box = this.checkbox(r.index);
      if (await this.isDisabled(box)) continue;
      if (await box.isChecked().catch(() => false)) continue;
      await box.check().catch(() => undefined);
      await waitForIdle(this.page);
      if (await box.isChecked().catch(() => false)) added.push(r.name);
    }
    return added;
  }

  async continue(): Promise<void> {
    await submitAndWait(this.page, this.saveContinue);
  }

  // --- QUERIES --------------------------------------------------------------

  async listRiders(): Promise<RiderRow[]> {
    const count = await this.riderRows.count();
    const out: RiderRow[] = [];
    for (let i = 0; i < count; i += 1) {
      const row = this.riderRows.nth(i);
      const testId = (await row.getAttribute('data-testid')) ?? '';
      const index = Number(testId.replace('rider-row-', ''));
      const rowText = ((await row.textContent()) ?? '').replace(/\s+/g, ' ').trim();
      // The first cell holds the rider name.
      const firstCell = row.locator('td, th').first();
      const name =
        (await firstCell.count()) > 0
          ? ((await firstCell.textContent()) ?? '').replace(/\s+/g, ' ').trim()
          : rowText.slice(0, 48);
      out.push({ index, name, rowText });
    }
    return out;
  }

  async availableRiders(): Promise<string[]> {
    return (await this.listRiders()).map((r) => r.name);
  }

  async isRiderSelected(name: string): Promise<boolean> {
    const index = await this.riderIndexByName(name);
    if (index === null) return false;
    return this.checkbox(index).isChecked().catch(() => false);
  }

  async isRiderBlocked(name: string): Promise<boolean> {
    const index = await this.riderIndexByName(name);
    if (index === null) return true;
    return this.isDisabled(this.checkbox(index));
  }

  async selectedRiderCount(): Promise<number> {
    const rows = await this.listRiders();
    let n = 0;
    for (const r of rows) {
      if (await this.checkbox(r.index).isChecked().catch(() => false)) n += 1;
    }
    return n;
  }

  async isHealthQuestionnaireVisible(): Promise<boolean> {
    return this.isVisible(this.healthQuestionnaire);
  }

  /**
   * Itemised rider premium lines.
   *
   * In this build `rider-premium-summary` is a single aggregate value
   * ("Current rider premium: $0.00"), not a per-rider breakdown. When no line
   * markup is present this returns one synthetic line carrying the aggregate, so
   * callers get a usable figure and TC-RID-007 can report the absence of
   * itemisation as the finding it is (R-RIDER-05).
   */
  async premiumBreakdown(): Promise<PremiumLine[]> {
    if (!(await this.isVisible(this.premiumSummary))) return [];

    const lines = this.premiumLines;
    const count = await lines.count();
    const out: PremiumLine[] = [];
    for (let i = 0; i < count; i += 1) {
      const text = ((await lines.nth(i).textContent()) ?? '').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      out.push({ label: text.replace(/[\d.,$]+\s*$/, '').trim(), amount: parseMoney(text) });
    }
    if (out.length > 0) return out;

    const aggregate = await this.premiumSummaryText();
    return aggregate ? [{ label: aggregate.replace(/[\d.,$]+\s*$/, '').trim(), amount: parseMoney(aggregate) }] : [];
  }

  /** True when the summary itemises per rider rather than showing one total. */
  async hasItemisedBreakdown(): Promise<boolean> {
    if (!(await this.isVisible(this.premiumSummary))) return false;
    return (await this.premiumLines.count()) > 0;
  }

  async total(): Promise<number> {
    if (!(await this.isVisible(this.premiumSummary))) return NaN;
    return parseMoney(await this.premiumSummary.textContent());
  }

  async premiumSummaryText(): Promise<string> {
    if (!(await this.isVisible(this.premiumSummary))) return '';
    return ((await this.premiumSummary.textContent()) ?? '').replace(/\s+/g, ' ').trim();
  }

  async riderErrorText(): Promise<string> {
    const messages = await this.validationMessages();
    return messages[0] ?? '';
  }
}
