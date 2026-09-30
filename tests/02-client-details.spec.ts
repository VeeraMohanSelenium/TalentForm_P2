import { expect, test } from '../src/fixtures/test-fixtures';
import { env } from '../src/config/env';
import { attachScreenshot } from '../src/utils/assertions';
import { dobBoundaries, makeClient } from '../src/utils/dataGenerator';

/**
 * TC-02  Client details - mandatory fields, DOB/age eligibility, save and progress.
 * Risks: R-CLI-01, R-CLI-02, R-CLI-03.
 */
test('TC-02 client details enforce mandatory fields and age eligibility @regression @client', async ({
  draftApplication,
  steps,
}, testInfo) => {
  const { page, applicationId } = draftApplication;
  const s = steps(applicationId);

  await test.step('All fields blank - mandatory validation is shown', async () => {
    await s.client.goto();
    await s.client.clearAllFields();
    await s.client.continue();

    // This build blocks the submit with native HTML5 "required" validation, so
    // the messages live on the inputs themselves, not in the DOM.
    const nativeInvalid = await page.evaluate(() =>
      Array.from(document.querySelectorAll('form input, form select'))
        .filter((e) => !(e as HTMLInputElement).checkValidity())
        .map((e) => (e as HTMLInputElement).name),
    );
    const serverMessages = await s.client.validationMessages();
    await testInfo.attach('blank-form-invalid-fields.txt', {
      body: `native: ${nativeInvalid.join(', ')}\nserver: ${serverMessages.join(' | ')}`,
      contentType: 'text/plain',
    });

    expect.soft(page.url(), 'A blank client form must not advance').toContain('/client');
    expect
      .soft(
        nativeInvalid.length + serverMessages.length,
        'Continuing with every field blank must raise mandatory-field validation',
      )
      .toBeGreaterThan(0);
  });

  await test.step(`Client one day under ${env.rules.minAge} is refused`, async () => {
    await s.client.goto();
    await s.client.fillPersonalDetails(makeClient({ dob: dobBoundaries.justUnderMinAge() }));
    await s.client.continue();
    await attachScreenshot(testInfo, page, 'underage-dob.png');
    expect
      .soft(
        await s.client.hasDobError(),
        `A client one day short of ${env.rules.minAge} must be refused on age eligibility`,
      )
      .toBeTruthy();
  });

  await test.step('Valid client saves and the application advances', async () => {
    await s.client.goto();
    await s.client.fillPersonalDetails(makeClient());
    await s.client.continue();
    expect(
      await s.client.hasValidationError(),
      `Valid client data was refused: ${JSON.stringify(await s.client.validationMessages())}`,
    ).toBeFalsy();
    expect(page.url(), 'The application should advance past the client step').not.toContain(
      '/client',
    );
  });
});
