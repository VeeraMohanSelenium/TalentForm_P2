import { expect, test } from '../src/fixtures/test-fixtures';
import { attachScreenshot } from '../src/utils/assertions';
import { makeAddress } from '../src/utils/dataGenerator';

/**
 * TC-03  Address and contact - "same as residential" copies AND persists.
 * Risks: R-ADDR-01, R-ADDR-05. Seeded defect observed on 2026-09-17: the copied
 * mailing address is shown on screen but is empty after save and reload.
 */
test('TC-03 same-as-residential copies the address and it persists after save @regression @address @seeded-defect', async ({
  draftApplication,
  steps,
}, testInfo) => {
  const { page, applicationId } = draftApplication;
  const s = steps(applicationId);
  const address = makeAddress();

  await test.step('Tick same-as-residential - mailing fields are copied', async () => {
    await s.address.goto();
    await s.address.fillResidential(address);
    await s.address.tickSameAsResidential();
    const mailing = await s.address.readMailing();
    expect(mailing.line1, 'Mailing line 1 was not copied').toBe(address.line1);
    expect(mailing.city, 'Mailing city was not copied').toBe(address.city);
    expect(mailing.zip, 'Mailing ZIP was not copied').toBe(address.zip);
  });

  await test.step('Save, reload - the mailing address is still there', async () => {
    await s.address.fillContact('persist.check@example.test', '5559876543');
    await s.address.saveDraft();
    await s.address.reload();
    await attachScreenshot(testInfo, page, 'address-after-reload.png');

    const mailing = await s.address.readMailing();
    expect(
      mailing.line1,
      'After save and reload the mailing address is empty. It was rendered by the ' +
        '"same as residential" checkbox but never persisted (R-ADDR-05).',
    ).toBe(address.line1);
    expect(mailing.zip, 'Mailing ZIP did not persist').toBe(address.zip);
  });
});
