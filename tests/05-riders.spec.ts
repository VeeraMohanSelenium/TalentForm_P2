import { expect, test } from '../src/fixtures/test-fixtures';
import { riders } from '../src/fixtures/applicationData';
import { attachScreenshot } from '../src/utils/assertions';
import { makePolicy } from '../src/utils/dataGenerator';

/**
 * TC-05  Riders - rider coverage cannot exceed the base sum assured.
 * Risk: R-RIDER-01.
 */
test('TC-05 rider coverage above the base sum assured is refused @regression @rider', async ({
  draftApplication,
  steps,
}, testInfo) => {
  const { page, applicationId } = draftApplication;
  const s = steps(applicationId);
  const BASE = 250_000;

  await s.product.goto();
  await s.product.completeWith(makePolicy({ faceValue: BASE }));

  await s.riders.goto();
  await s.riders.addRider(riders.accidentalDeath, BASE + 50_000);
  await s.riders.continue();
  await attachScreenshot(testInfo, page, 'rider-over-base.png');

  expect(
    await s.riders.hasValidationError(/coverage|exceed|face value|sum assured|base|limit/i),
    `Rider coverage of ${(BASE + 50_000).toLocaleString()} exceeds the base sum assured of ` +
      `${BASE.toLocaleString()} and must be refused (R-RIDER-01).`,
  ).toBeTruthy();
});
