import { expect, test } from '../src/fixtures/test-fixtures';
import { attachScreenshot, expectPremiumChanged } from '../src/utils/assertions';
import { makePolicy } from '../src/utils/dataGenerator';

/**
 * TC-04  Product configuration - sum assured limits and premium recalculation.
 * Risks: R-PROD-01, R-PROD-02.
 *
 * Limits are those published on the /products catalog for SecureLife Whole Life
 * (sum assured 100,000 - 1,000,000). Both sides of each boundary are tested,
 * because an off-by-one is only visible that way.
 */
const MIN = 100_000;
const MAX = 1_000_000;

test('TC-04 sum assured limits are enforced and premium recalculates @regression @product', async ({
  draftApplication,
  steps,
}, testInfo) => {
  const { page, applicationId } = draftApplication;
  const s = steps(applicationId);

  const cases = [
    { value: MIN - 1, valid: false },
    { value: MIN, valid: true },
    { value: MAX, valid: true },
    { value: MAX + 1, valid: false },
  ];

  for (const { value, valid } of cases) {
    await test.step(`Sum assured ${value.toLocaleString()} is ${valid ? 'accepted' : 'refused'}`, async () => {
      await s.product.goto();
      await s.product.configure(makePolicy({ faceValue: value }));
      await s.product.continue();
      expect
        .soft(
          await s.product.hasFaceValueError(),
          valid
            ? `${value.toLocaleString()} is inside ${MIN.toLocaleString()}-${MAX.toLocaleString()} and must be accepted`
            : `${value.toLocaleString()} is outside ${MIN.toLocaleString()}-${MAX.toLocaleString()} and must be refused`,
        )
        .toBe(!valid);
    });
  }

  await test.step('Changing premium frequency recalculates the premium', async () => {
    await s.product.goto();
    await s.product.configure(makePolicy({ premiumFrequency: 'Annual' }));
    const { before, after } = await s.product.premiumAround(async () => {
      await s.product.setPremiumFrequency('Monthly');
    });
    await attachScreenshot(testInfo, page, 'premium-after-frequency-change.png');
    expectPremiumChanged(before, after, 'changing the premium frequency from Annual to Monthly');
  });
});
