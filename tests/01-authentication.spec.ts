import { expect, test } from '../src/fixtures/test-fixtures';
import { users, WRONG_PASSWORD } from '../src/fixtures/users';
import { DashboardPage } from '../src/pages';
import { attachScreenshot } from '../src/utils/assertions';

/**
 * TC-01  Authentication - valid and invalid login.
 * Risks: R-AUTH-01, R-AUTH-02 (Submission 1 risk register).
 */
test('TC-01 agent login accepts valid credentials and rejects invalid ones @smoke @auth', async ({
  page,
  loginPage,
}, testInfo) => {
  await test.step('Blank username and password show mandatory validation', async () => {
    await loginPage.goto();
    await loginPage.submitEmpty();
    await expect(page, 'Submitting an empty form must not navigate away').toHaveURL(/\/login/);
    expect(
      (await loginPage.fieldErrors()).length,
      'Email and password are mandatory, so a validation message was expected',
    ).toBeGreaterThan(0);
  });

  await test.step('Wrong password is rejected with a non-revealing error', async () => {
    await loginPage.open(users.agent.username, WRONG_PASSWORD);
    await expect(page, 'A failed login must stay on the login page').toHaveURL(/\/login/);
    await expect(loginPage.errorBanner, 'A credential error must be shown').toBeVisible();
    expect(await loginPage.errorText(), 'The error must not echo the password').not.toContain(
      WRONG_PASSWORD,
    );
    await attachScreenshot(testInfo, page, 'invalid-login.png');
  });

  await test.step('Valid credentials land on the dashboard', async () => {
    await loginPage.open(users.agent.username, users.agent.password);
    await expect(page, 'A valid agent must land on the dashboard').toHaveURL(/\/dashboard/);
    await expect(
      new DashboardPage(page).newApplicationCta,
      'The dashboard must offer the start-new-application action',
    ).toBeVisible();
    await attachScreenshot(testInfo, page, 'dashboard.png');
  });
});
