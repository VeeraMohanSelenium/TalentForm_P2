import { expect, test } from '../src/fixtures/test-fixtures';
import { documentTypes } from '../src/fixtures/applicationData';
import { attachScreenshot } from '../src/utils/assertions';
import { unsupportedType, validPdf } from '../src/utils/fileUploadHelper';

/**
 * TC-07  Documents - valid upload persists, unsupported type is rejected.
 * Risks: R-DOC-01, R-DOC-04.
 */
test('TC-07 a valid document persists and an unsupported file type is rejected @regression @document', async ({
  draftApplication,
  steps,
}, testInfo) => {
  const { page, applicationId } = draftApplication;
  const s = steps(applicationId);

  await test.step('Unsupported .exe file is rejected', async () => {
    await s.documents.goto();
    await s.documents.upload(unsupportedType());
    await attachScreenshot(testInfo, page, 'exe-upload.png');
    expect
      .soft(await s.documents.hasTypeError(), 'An .exe was accepted as a KYC document (R-DOC-01)')
      .toBeTruthy();
  });

  await test.step('Valid PDF uploads and is still listed after reload', async () => {
    const file = validPdf();
    await s.documents.goto();
    await s.documents.upload(file, documentTypes.idProof);
    expect(
      await s.documents.isUploaded(file.name),
      `"${file.name}" is not in the uploaded list`,
    ).toBeTruthy();
    await s.documents.reload();
    expect(
      await s.documents.isUploaded(file.name),
      'The document disappeared after reload - it was never persisted (R-DOC-04)',
    ).toBeTruthy();
  });
});
