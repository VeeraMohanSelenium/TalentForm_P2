import { Page, test as base } from '@playwright/test';
import { API_UNAVAILABLE_REASON, ApiClient } from '../utils/apiClient';
import { TestUser, users } from './users';
import {
  AddressContactPage,
  ApplicationStatusPage,
  BeneficiaryPage,
  ClientInformationPage,
  ConfirmationPage,
  DashboardPage,
  DocumentUploadPage,
  KycFinancialPage,
  LoginPage,
  ProductCatalogPage,
  ProductConfigurationPage,
  ReviewPage,
  RiderSelectionPage,
} from '../pages';
import { ApplicationData, validApplication } from './applicationData';
import { validPdf } from '../utils/fileUploadHelper';

/**
 * Custom fixtures.
 *
 * Two exist so that tests do not re-walk the whole journey to reach the step they
 * care about (Study and QA Plan, section 8.3):
 *   `agentPage`      - a browser page already logged in as the primary agent
 *   `draftApplication` - that page, plus a freshly created draft application ID
 *
 * Page object fixtures are provided too, so a test never constructs one by hand.
 */

export interface PageObjects {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  productCatalogPage: ProductCatalogPage;
}

export interface Fixtures extends PageObjects {
  /** A page authenticated as the primary agent. */
  agentPage: Page;
  /** An authenticated API client sharing the agent's session. */
  api: ApiClient;
  /** A newly created draft application: the page plus its ID. */
  draftApplication: { page: Page; applicationId: string };
  /** Convenience factory for the per-application step pages. */
  steps: (applicationId: string, page?: Page) => StepPages;
  /** Logs in as an arbitrary role in its own context. */
  loginAs: (user: TestUser) => Promise<Page>;
}

export interface StepPages {
  client: ClientInformationPage;
  address: AddressContactPage;
  kyc: KycFinancialPage;
  product: ProductConfigurationPage;
  riders: RiderSelectionPage;
  beneficiaries: BeneficiaryPage;
  documents: DocumentUploadPage;
  review: ReviewPage;
  confirmation: ConfirmationPage;
  status: ApplicationStatusPage;
}

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },

  productCatalogPage: async ({ page }, use) => {
    await use(new ProductCatalogPage(page));
  },

  agentPage: async ({ page }, use) => {
    const login = new LoginPage(page);
    await login.open(users.agent.username, users.agent.password);

    // Login lands on /change-password in this build. LoginPage.open() already
    // steps past it, but the app occasionally re-redirects, so settle on the
    // dashboard explicitly rather than waiting for a URL that may not arrive.
    if (!/\/dashboard/.test(page.url())) {
      await page.goto('/dashboard');
      await page.waitForLoadState('domcontentloaded');
    }
    await use(page);
  },

  /**
   * Authenticated API client.
   *
   * Skips the test when this build exposes no API at all, rather than failing
   * every cross-layer test with an opaque login error. See
   * API_UNAVAILABLE_REASON in src/utils/apiClient.ts.
   */
  api: async ({}, use) => {
    const client = await ApiClient.asAgent();
    test.info().skip(!client.available, API_UNAVAILABLE_REASON);
    await use(client);
    await client.dispose();
  },

  draftApplication: async ({ agentPage }, use) => {
    const dashboard = new DashboardPage(agentPage);
    await dashboard.goto();
    const applicationId = await dashboard.startNewApplication();
    await use({ page: agentPage, applicationId });
  },

  steps: async ({ page }, use) => {
    const factory = (applicationId: string, override?: Page): StepPages => {
      const p = override ?? page;
      return {
        client: new ClientInformationPage(p, applicationId),
        address: new AddressContactPage(p, applicationId),
        kyc: new KycFinancialPage(p, applicationId),
        product: new ProductConfigurationPage(p, applicationId),
        riders: new RiderSelectionPage(p, applicationId),
        beneficiaries: new BeneficiaryPage(p, applicationId),
        documents: new DocumentUploadPage(p, applicationId),
        review: new ReviewPage(p, applicationId),
        confirmation: new ConfirmationPage(p, applicationId),
        status: new ApplicationStatusPage(p, applicationId),
      };
    };
    await use(factory);
  },

  loginAs: async ({ browser }, use) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    const fn = async (user: TestUser): Promise<Page> => {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      await new LoginPage(page).open(user.username, user.password);
      return page;
    };
    await use(fn);
    for (const context of contexts) await context.close();
  },
});

export const expect = test.expect;

/**
 * Drives an application from a fresh draft through to the review page with valid
 * data. Used by the E2E test and by any test that needs a complete application
 * before introducing a single deliberate fault.
 */
export async function completeApplicationToReview(
  steps: StepPages,
  data: ApplicationData = validApplication(),
): Promise<ApplicationData> {
  await steps.client.goto();
  await steps.client.completeWith(data.client);

  await steps.address.goto();
  await steps.address.completeWith(data.address, data.client.email, data.client.mobile);

  await steps.kyc.goto();
  await steps.kyc.completeWith(data.financials, data.client.ssn);

  await steps.product.goto();
  await steps.product.completeWith(data.policy);

  // Riders are optional; continue without selecting any.
  await steps.riders.goto();
  await steps.riders.continue();

  await steps.beneficiaries.goto();
  await steps.beneficiaries.addBeneficiaries(data.beneficiaries);
  await steps.beneficiaries.continue();

  await steps.documents.goto();
  const documentType = await steps.documents.selectFirstDocumentType();
  await steps.documents.upload(validPdf(), documentType || undefined);
  await steps.documents.continue();

  await steps.review.goto();
  return data;
}
