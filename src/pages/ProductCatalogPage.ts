import { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';
import { waitForIdle } from '../utils/testHelpers';

export interface ProductCard {
  /** The product code embedded in the data-testid, e.g. WL_ELITE_LEGACY. */
  code: string;
  name: string;
  text: string;
}

/**
 * Whole Life product catalogue. Covers PROD-V01, PROD-V02.
 * Locators verified against the live DOM on 2026-09-17.
 *
 * Four products are seeded: WL_ELITE_LEGACY, WL_FLEXI_PAY, WL_SECURE_BASIC,
 * WL_WEALTH_BUILDER.
 */
export class ProductCatalogPage extends BasePage {
  get path(): string {
    return '/products';
  }

  // --- LOCATORS (verified) --------------------------------------------------
  readonly root: Locator;
  readonly productCards: Locator;
  readonly detailHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('product-catalog-page');
    this.productCards = page.locator('[data-testid^="product-card-"]');
    this.detailHeading = page.getByRole('heading', { level: 1 }).first();
  }

  get searchInput(): Locator {
    return this.page.getByRole('searchbox');
  }

  // --- ACTIONS --------------------------------------------------------------

  async openProductByCode(code: string): Promise<void> {
    await this.page.getByTestId(`product-details-${code}`).click();
    await waitForIdle(this.page);
  }

  async openProduct(name: string): Promise<void> {
    const card = this.productCards.filter({ hasText: name }).first();
    await card.getByRole('link').or(card.getByRole('button')).first().click();
    await waitForIdle(this.page);
  }

  async openFirstProduct(): Promise<string> {
    const products = await this.listProducts();
    if (products.length === 0) throw new Error('The product catalogue is empty.');
    await this.openProductByCode(products[0].code);
    return products[0].name;
  }

  // --- QUERIES --------------------------------------------------------------

  async listProducts(): Promise<ProductCard[]> {
    const count = await this.productCards.count();
    const out: ProductCard[] = [];
    for (let i = 0; i < count; i += 1) {
      const card = this.productCards.nth(i);
      const testId = (await card.getAttribute('data-testid')) ?? '';
      const code = testId.replace('product-card-', '');
      const text = ((await card.textContent()) ?? '').replace(/\s+/g, ' ').trim();
      const heading = card.getByRole('heading').first();
      const name =
        (await heading.count()) > 0
          ? ((await heading.textContent()) ?? '').trim()
          : text.slice(0, 48);
      out.push({ code, name, text });
    }
    return out;
  }

  async productCodes(): Promise<string[]> {
    return (await this.listProducts()).map((p) => p.code);
  }

  async productCount(): Promise<number> {
    return this.productCards.count();
  }

  async hasProduct(name: string): Promise<boolean> {
    return (await this.productCards.filter({ hasText: name }).count()) > 0;
  }

  async detailText(): Promise<string> {
    return ((await this.page.locator('main, body').first().textContent()) ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** PROD-V02 requires features, eligibility and coverage limits to be present. */
  async detailSectionsVisible(): Promise<{ features: boolean; eligibility: boolean; limits: boolean }> {
    const text = (await this.detailText()).toLowerCase();
    return {
      features: /feature|benefit/.test(text),
      eligibility: /eligib|entry age|qualif/.test(text),
      limits: /coverage|minimum|maximum|sum assured|limit/.test(text),
    };
  }
}
