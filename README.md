# Insurance Order Entry – Playwright Automation (Submission 2)

A TypeScript Playwright suite for the **Insurance Order Entry Demo Platform**. It covers
**8 high-level test cases**, one for each core module in the Assignment 2 guidelines
(section 7), and each maps to risk IDs from the Submission 1 QA plan.

| ID | Module | What it proves | Tags |
|---|---|---|---|
| TC-01 | Authentication | Blank / wrong-password login rejected; valid login reaches dashboard | `@smoke` |
| TC-02 | Client Details | Mandatory fields enforced; under-18 DOB refused; valid client advances | `@regression` |
| TC-03 | Address & Contact | Same-as-residential copies **and persists** after save + reload | `@seeded-defect` |
| TC-04 | Product Configuration | Sum assured min/max boundaries (both sides); premium recalculates on frequency change | `@regression` |
| TC-05 | Riders | Rider coverage above base sum assured refused | `@regression` |
| TC-06 | Beneficiaries | Primary allocation must be exactly 100% (90 / 110 blocked, 100 accepted) | `@seeded-defect` |
| TC-07 | Documents | `.exe` rejected; valid PDF uploads and survives reload | `@regression` |
| TC-08 | Review & Submission | End-to-end: all steps → validation clean → submit → reference number | `@smoke` `@e2e` |

The full test-case design (preconditions, steps, data, expected result, severity,
evidence, status, result) is in `../Test Case Design Sheet - High Level.xlsx`.

## Folder structure

```
playwright.config.ts        reporters, evidence settings, single worker
.env.example                every environment value, with non-sensitive placeholders
src/
  config/env.ts             loads and validates .env – the only place config is read
  pages/                    page objects (BasePage + one per screen)
  fixtures/test-fixtures.ts agentPage, draftApplication, steps() fixtures
  fixtures/users.ts         credentials, read from env
  fixtures/applicationData.ts  valid application builder, beneficiary splits, product list
  utils/                    data generator, assertions, upload files, API client, helpers
tests/                      01-authentication.spec.ts … 08-review-submission.spec.ts
.github/workflows/playwright.yml
```

Design choices:
- **Locators** use `data-testid` first, then role/label. They are declared once, at the top of each page object.
- **No hard-coding.** The URL, credentials and rule values come from `.env`, and test data is generated per run (`dataGenerator.ts`), so reruns don't collide.
- **Fixtures** log in and create a fresh draft application, so each test starts at the step it cares about and doesn't depend on the other tests.
- **Expected results come from business rules, not from what the app currently does.** That way a seeded defect shows up as a failure.
- **Soft assertions** inside multi-step cases, so one run reports every broken rule rather than only the first.

## Setup

Requires Node 18+.

```bash
npm ci
npx playwright install chromium
cp .env.example .env        # then edit BASE_URL and AGENT_USERNAME / AGENT_PASSWORD
```

`BASE_URL` is the insurance app (port **8081**). Port 8082 is FinServe, which is out of scope.

## Run

```bash
npm test                    # all 8
npm run test:smoke          # TC-01, TC-08
npm run test:seeded         # TC-03, TC-06
npm run test:headed         # watch it run
npx playwright test tests/06-beneficiaries.spec.ts   # a single case
npm run report              # open the HTML report
npx playwright show-trace test-results/<test>/trace.zip
npm run typecheck
```

## Evidence

| Artifact | When | Where |
|---|---|---|
| HTML report | every run | `playwright-report/index.html` |
| JSON results | every run | `test-results/results.json` |
| Screenshot | every test, plus named step screenshots | attached in the report |
| Video + trace | on failure | `test-results/<test>/` |

## Known limitations

- **Shared demo account.** The only credential supplied is the demo user printed on the login page, and every learner shares it. If it has been changed or locked, every test fails at login with "Invalid credentials." This is an environment problem, not a test failure. Set a dedicated account in `.env`. The suite never changes the password.
- **One worker.** The lab app returns HTTP 500 under parallel load, so `workers: 1`. A full run takes about 8 minutes.
- **No DB access** (Q-04). Persistence is proved by save → reload → re-read in the UI.
- **Seeded defect catalogue not supplied.** TC-03 and TC-06 are tagged `@seeded-defect` because they fail against correct business rules on two separate dates.
- **CI.** The UI job needs a self-hosted runner that can reach the lab VM. The type-check job runs anywhere.
- Out of this high-level set: lockout, OTP reset, password reuse and data isolation (no accounts supplied), ZIP/state/email/phone format, and inactive product.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Every test fails at login | Check the credentials by hand at `/login`. The shared demo account may have been changed. |
| `BASE_URL is required` | `.env` is missing or not in the project root. |
| `net::ERR_CONNECTION_RESET` / timeouts | The lab VM is stopped or restarting. Check `BASE_URL` in a browser, and start the VM from TalentFarm → Labs. |
| Product/rider/E2E fail with "sum assured below minimum" | The product catalogue changed. `makePolicy()` defaults to SecureLife 250,000 – check `/products`. |
| HTTP 500 on draft creation | Parallel load. Keep `workers: 1`. |
