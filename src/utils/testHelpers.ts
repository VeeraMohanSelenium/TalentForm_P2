import { Locator, Page } from '@playwright/test';

/**
 * Small shared helpers.
 *
 * Nothing here waits on a fixed timeout. Playwright's auto-waiting and web-first
 * assertions do the waiting; a hardcoded wait is treated as a defect in the test
 * (Study and QA Plan, section 8.3).
 */

/**
 * Resolves the first locator in a list that is attached to the DOM.
 *
 * The application DOM has not been inspected yet (question Q-11), so page objects
 * declare a preferred locator plus fallbacks. This picks whichever exists, and
 * reports clearly when none does, rather than failing with an opaque timeout.
 * Once locators are confirmed against the running application, collapse each
 * call site to the single locator that works.
 */
export async function firstAvailable(
  candidates: Locator[],
  description: string,
): Promise<Locator> {
  for (const candidate of candidates) {
    if ((await candidate.count()) > 0) return candidate.first();
  }
  throw new Error(
    `None of the ${candidates.length} candidate locators for "${description}" matched anything ` +
      `on this page. Run "npm run verify:locators" and update the locator block in the page object.`,
  );
}

/** True when the element exists and is visible, without throwing if it does not. */
export async function isVisible(locator: Locator): Promise<boolean> {
  return (await locator.count()) > 0 && (await locator.first().isVisible());
}

/** True when a control is present but not interactable. */
export async function isDisabled(locator: Locator): Promise<boolean> {
  if ((await locator.count()) === 0) return false;
  const el = locator.first();
  if (await el.isDisabled().catch(() => false)) return true;
  const ariaDisabled = await el.getAttribute('aria-disabled');
  return ariaDisabled === 'true';
}

/** Fills a field only when a value is supplied, so partial-draft tests stay readable. */
export async function fillIfPresent(locator: Locator, value: string | undefined): Promise<void> {
  if (value === undefined || value === '') return;
  await locator.fill(value);
}

/**
 * Selects an option by value, label or visible text, case-insensitively.
 *
 * This build uses uppercase enum values (MALE, SINGLE, ANNUAL, PRIMARY …) whose
 * option text sometimes differs from the value. Rather than guess, this reads
 * the real options once and matches against both, which also fails immediately
 * with a useful message instead of burning the action timeout on each retry.
 */
export async function selectOption(locator: Locator, wanted: string): Promise<void> {
  const options = await locator.locator('option').evaluateAll((els) =>
    els.map((e) => ({
      value: (e as HTMLOptionElement).value,
      text: (e.textContent ?? '').trim(),
    })),
  );

  const needle = wanted.trim().toLowerCase();
  const normalise = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '');

  const match =
    options.find((o) => o.value.toLowerCase() === needle) ??
    options.find((o) => o.text.toLowerCase() === needle) ??
    options.find((o) => normalise(o.value) === normalise(wanted)) ??
    options.find((o) => normalise(o.text) === normalise(wanted)) ??
    options.find((o) => o.value !== '' && normalise(o.text).startsWith(normalise(wanted)));

  if (!match) {
    throw new Error(
      `No option matching "${wanted}". Available: ` +
        options.map((o) => `${o.value || '""'}=${o.text}`).join(' | '),
    );
  }

  await locator.selectOption(match.value);
}

/** Selects the first option that is not the empty placeholder. Returns its label. */
export async function selectFirstRealOption(locator: Locator): Promise<string> {
  const options = await locator.locator('option').evaluateAll((els) =>
    els.map((e) => ({
      value: (e as HTMLOptionElement).value,
      text: (e.textContent ?? '').trim(),
    })),
  );
  const first = options.find((o) => o.value !== '');
  if (!first) throw new Error('The select has no selectable option.');
  await locator.selectOption(first.value);
  return first.text;
}

/** Extracts the application ID from a URL like /applications/1234/client. */
export function applicationIdFromUrl(url: string): string {
  const match = url.match(/\/applications\/([^/?#]+)/);
  if (!match) {
    throw new Error(`Could not read an application ID from URL: ${url}`);
  }
  return match[1];
}

/**
 * Clicks a control that submits a form, and waits for the resulting navigation.
 *
 * `click()` followed by `waitForLoadState('domcontentloaded')` is a race: the
 * load state can resolve against the page that is still on screen, before the
 * POST has even been issued. The next `goto()` then aborts the in-flight request
 * and the step silently fails to save — which is exactly how the address and
 * product steps appeared to "not persist" during bring-up.
 */
export async function submitAndWait(page: Page, control: Locator): Promise<void> {
  const before = page.url();
  await Promise.all([
    page
      .waitForURL((url) => url.toString() !== before, { timeout: 30_000 })
      .catch(() => undefined),
    control.click(),
  ]);
  await page.waitForLoadState('domcontentloaded');
}

/** Waits for the page to settle after an action that triggers a server round-trip. */
export async function waitForIdle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {
    // networkidle can never settle on pages that poll; the assertion that follows
    // will do the real waiting.
  });
}

/**
 * Collects the text of every visible validation ERROR on the page.
 *
 * Bootstrap gives success banners `role="alert"` too, so a naive `[role=alert]`
 * query counts "Client information saved." as a validation failure. Success and
 * informational variants are excluded here by class and by wording.
 */
export async function collectValidationMessages(page: Page): Promise<string[]> {
  const nodes = page.locator(
    '[role="alert"], .invalid-feedback, .error-message, [data-testid$="-error"], ' +
      '[data-testid="validation-error-alert"], [data-testid="review-validation-errors"]',
  );
  const count = await nodes.count();
  const out: string[] = [];

  for (let i = 0; i < count; i += 1) {
    const el = nodes.nth(i);
    if (!(await el.isVisible())) continue;

    const className = (await el.getAttribute('class')) ?? '';
    if (/alert-success|alert-info|alert-primary|alert-light/.test(className)) continue;

    const text = (await el.textContent())?.replace(/\s+/g, ' ').trim();
    if (!text) continue;

    // A confirmation phrased as an alert is not a validation error.
    if (/^[^.!]{0,60}\b(saved|updated|created|uploaded|added|removed|submitted successfully)\b/i.test(text)) {
      continue;
    }

    out.push(text);
  }
  return out;
}

/** The visible success banner text, if any. Useful as a positive assertion. */
export async function successMessage(page: Page): Promise<string> {
  const banner = page.locator('.alert-success, [role="status"]').first();
  if ((await banner.count()) === 0 || !(await banner.isVisible())) return '';
  return ((await banner.textContent()) ?? '').replace(/\s+/g, ' ').trim();
}

/** Formats a tag list for a test title so the sheet and the report line up. */
export function tc(id: string, title: string): string {
  return `${id} - ${title}`;
}
