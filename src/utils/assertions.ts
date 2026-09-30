import { APIResponse, expect, Locator, Page, TestInfo } from '@playwright/test';
import { describeResponse, safeJson } from './apiClient';

/**
 * Shared assertions.
 *
 * Two rules are enforced here rather than left to each test:
 *  - every assertion states the business outcome, not merely that a page loaded;
 *  - every failure carries enough attached evidence to be reproduced by someone
 *    who did not run it (Study and QA Plan, sections 8.3 and 8.6).
 */

/** Asserts a validation error is visible and, where given, that its text matches. */
export async function expectValidationError(
  scope: Page | Locator,
  opts: { containing?: string | RegExp; near?: string } = {},
): Promise<void> {
  const root = 'locator' in scope ? scope : scope;
  const error = root
    .locator('[role="alert"], .invalid-feedback, .error-message, [data-testid$="-error"]')
    .filter(opts.containing ? { hasText: opts.containing } : {})
    .first();

  await expect(
    error,
    `Expected a validation error${opts.near ? ` near "${opts.near}"` : ''}` +
      `${opts.containing ? ` containing ${opts.containing}` : ''}, but none was visible.`,
  ).toBeVisible();
}

/** Asserts that NO validation error is present — used to prove a boundary is accepted. */
export async function expectNoValidationError(scope: Page | Locator): Promise<void> {
  const errors = scope.locator('[role="alert"], .invalid-feedback, .error-message');
  await expect(
    errors,
    'Expected the value to be accepted, but a validation error was displayed.',
  ).toHaveCount(0);
}

/** Asserts a response is a client-side rejection (4xx), not a server error or a success. */
export async function expectRejected(res: APIResponse, context: string): Promise<void> {
  const status = res.status();
  expect(
    status >= 400 && status < 500,
    `${context}\nExpected a 4xx rejection but got ${status}.\n${await describeResponse(res)}`,
  ).toBeTruthy();
}

/** Asserts an endpoint refuses an unauthenticated caller (R-API-02). */
export async function expectUnauthorised(res: APIResponse, endpoint: string): Promise<void> {
  expect(
    [401, 403].includes(res.status()),
    `${endpoint} must reject an unauthenticated caller with 401 or 403, ` +
      `but returned ${res.status()}. This is a critical access-control defect.\n` +
      `${await describeResponse(res)}`,
  ).toBeTruthy();
}

/** Asserts a response is 2xx, surfacing the body when it is not. */
export async function expectOk(res: APIResponse, context: string): Promise<void> {
  expect(res.ok(), `${context}\n${await describeResponse(res)}`).toBeTruthy();
}

/** Asserts a JSON object carries the given keys — a lightweight schema check (R-API-03). */
export async function expectSchema(
  res: APIResponse,
  keys: string[],
  context: string,
): Promise<any> {
  const body = await safeJson(res);
  expect(body, `${context}: response was not JSON.\n${await describeResponse(res)}`).toBeTruthy();

  const subject = Array.isArray(body) ? body[0] : (body.data ?? body);
  const target = Array.isArray(subject) ? subject[0] : subject;
  expect(target, `${context}: no object found in the response to check.`).toBeTruthy();

  const missing = keys.filter((k) => !(k in target));
  expect(
    missing,
    `${context}: response is missing expected field(s) ${missing.join(', ')}. ` +
      `Present: ${Object.keys(target).join(', ')}`,
  ).toHaveLength(0);

  return body;
}

/** Parses a currency string like "$1,234.56" into a number. */
export function parseMoney(text: string | null): number {
  if (!text) return NaN;
  const cleaned = text.replace(/[^0-9.-]/g, '');
  return Number.parseFloat(cleaned);
}

/** Asserts two money values match within a tolerance, for premium reconciliation. */
export function expectMoneyEqual(
  actual: number,
  expected: number,
  context: string,
  tolerance = 0.01,
): void {
  expect(
    Math.abs(actual - expected) <= tolerance,
    `${context}\nExpected ${expected.toFixed(2)} but got ${actual.toFixed(2)}.`,
  ).toBeTruthy();
}

/** Asserts a premium changed after a configuration change (R-PROD-02). */
export function expectPremiumChanged(before: number, after: number, change: string): void {
  expect(
    Number.isFinite(before) && Number.isFinite(after),
    `Could not read the premium before/after ${change} (before=${before}, after=${after}).`,
  ).toBeTruthy();
  expect(
    after,
    `Premium did not recalculate after ${change}. It stayed at ${before.toFixed(2)}. ` +
      `This is a calculation defect, not a display issue.`,
  ).not.toBe(before);
}

// ---------------------------------------------------------------- evidence

/** Attaches an API response to the report so a defect can be raised from it directly. */
export async function attachResponse(
  testInfo: TestInfo,
  name: string,
  res: APIResponse,
): Promise<void> {
  await testInfo.attach(name, {
    body: await describeResponse(res),
    contentType: 'text/plain',
  });
}

/** Attaches arbitrary evidence text, e.g. a database query result (section 8.4). */
export async function attachEvidence(
  testInfo: TestInfo,
  name: string,
  content: string,
): Promise<void> {
  await testInfo.attach(name, { body: content, contentType: 'text/plain' });
}

/** Attaches a named screenshot on a passing test where the sheet requires it as evidence. */
export async function attachScreenshot(
  testInfo: TestInfo,
  page: Page,
  name: string,
): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}
