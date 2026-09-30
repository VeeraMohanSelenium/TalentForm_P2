import { expect, test } from '../src/fixtures/test-fixtures';
import { completeApplicationToReview } from '../src/fixtures/test-fixtures';
import { validApplication } from '../src/fixtures/applicationData';
import { attachScreenshot } from '../src/utils/assertions';

/**
 * TC-08  Review and submission - end-to-end smoke path.
 * Risks: R-WF-01, R-WF-03, R-WF-06.
 *
 * Login -> new application -> every step with valid data -> review ->
 * run validation -> submit -> confirmation with a reference number.
 */
test('TC-08 a complete valid application passes validation, submits and gets a reference @smoke @workflow @e2e', async ({
  draftApplication,
  steps,
}, testInfo) => {
  test.slow();
  const { page, applicationId } = draftApplication;
  const s = steps(applicationId);

  await test.step('Complete every step with valid data and reach review', async () => {
    await completeApplicationToReview(s, validApplication());
  });

  await test.step('Validation summary is clean and submit is enabled', async () => {
    await s.review.runValidation();
    const outstanding = await s.review.validationEntryList();
    await attachScreenshot(testInfo, page, 'review-before-submit.png');
    expect(
      outstanding.map((e) => e.text),
      'A fully and validly completed application still reports validation errors',
    ).toHaveLength(0);
    expect(await s.review.isSubmitEnabled(), 'Submit is disabled on a valid application').toBeTruthy();
  });

  await test.step('Submit - confirmation page shows a reference number', async () => {
    await s.review.submit();
    await expect(page, 'Submission must land on the confirmation page').toHaveURL(
      /confirmation|success|submitted/i,
    );
    const reference = await s.confirmation.reference();
    await attachScreenshot(testInfo, page, 'confirmation.png');
    expect(reference, 'No application reference number was issued (R-WF-06)').toBeTruthy();
    await testInfo.attach('application-reference.txt', {
      body: `applicationId=${applicationId}\nreference=${reference}`,
      contentType: 'text/plain',
    });
  });
});
