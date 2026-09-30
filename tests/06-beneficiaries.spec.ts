import { expect, test } from '../src/fixtures/test-fixtures';
import { beneficiariesTotalling } from '../src/fixtures/applicationData';
import { DashboardPage } from '../src/pages';
import { attachScreenshot } from '../src/utils/assertions';

/**
 * TC-06  Beneficiaries - primary allocation must total exactly 100%.
 * Risk: R-BEN-01. Seeded defect observed on 2026-09-17: 90% and 110% were both
 * accepted without an allocation error.
 *
 * Each allocation is tried on its own fresh draft so one case cannot leave
 * beneficiaries behind for the next.
 */
test('TC-06 beneficiary allocation must total exactly 100% @regression @beneficiary @seeded-defect', async ({
  draftApplication,
  steps,
}, testInfo) => {
  const { page } = draftApplication;
  const dashboard = new DashboardPage(page);

  const cases = [
    { total: 90, valid: false },
    { total: 110, valid: false },
    { total: 100, valid: true },
  ];

  for (const [i, { total, valid }] of cases.entries()) {
    await test.step(`Allocation of ${total}% is ${valid ? 'accepted' : 'blocked'}`, async () => {
      let applicationId = draftApplication.applicationId;
      if (i > 0) {
        await dashboard.goto();
        applicationId = await dashboard.startNewApplication();
      }
      const s = steps(applicationId);

      await s.beneficiaries.goto();
      await s.beneficiaries.addBeneficiaries(beneficiariesTotalling(total, 2));
      await s.beneficiaries.continue();
      await attachScreenshot(testInfo, page, `allocation-${total}.png`);

      expect
        .soft(
          await s.beneficiaries.hasAllocationError(),
          valid
            ? 'An allocation totalling exactly 100% is valid and must be accepted'
            : `Primary allocation totals ${total}%, so the payout cannot be distributed as ` +
                `written. The application must not proceed (R-BEN-01).`,
        )
        .toBe(!valid);
    });
  }
});
