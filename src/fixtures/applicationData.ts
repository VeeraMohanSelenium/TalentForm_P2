import {
  AddressData,
  BeneficiaryData,
  ClientData,
  FinancialData,
  PolicyData,
  makeAddress,
  makeBeneficiary,
  makeClient,
  makeFinancials,
  makePolicy,
  splitAllocation,
} from '../utils/dataGenerator';

/**
 * Complete, internally consistent application data sets.
 *
 * Each call produces fresh, unique values so tests remain independent and
 * parallel-safe (Study and QA Plan, section 4.2).
 */

export interface ApplicationData {
  client: ClientData;
  address: AddressData;
  financials: FinancialData;
  policy: PolicyData;
  beneficiaries: BeneficiaryData[];
}

/** A complete application that should submit cleanly — the happy path. */
export function validApplication(overrides: Partial<ApplicationData> = {}): ApplicationData {
  return {
    client: makeClient(),
    address: makeAddress(),
    financials: makeFinancials(),
    policy: makePolicy(),
    beneficiaries: [makeBeneficiary({ allocation: 100 })],
    ...overrides,
  };
}

/** Two primary beneficiaries splitting an arbitrary total, for allocation tests. */
export function beneficiariesTotalling(total: number, count = 2): BeneficiaryData[] {
  return splitAllocation(total, count).map((allocation) => makeBeneficiary({ allocation }));
}

/** A premium the declared income cannot plausibly support (R-KYC-03). */
export function unaffordableApplication(): ApplicationData {
  return validApplication({
    financials: makeFinancials({
      annualIncome: 12_000,
      netWorth: 5_000,
      riskProfile: 'Conservative',
    }),
    policy: makePolicy({ faceValue: 2_000_000, premiumFrequency: 'Monthly' }),
  });
}

/**
 * The nine riders this build offers, confirmed against the live DOM on
 * 2026-09-17. Riders are addressed by 1-based row index in the markup; these
 * names are matched against the row text by RiderSelectionPage.
 */
export const riders = {
  accidentalDeath: 'Accidental Death Benefit Rider',
  permanentDisability: 'Permanent Disability Rider',
  termRider: 'Term Rider Add-on',
  criticalIllness: 'Critical Illness Rider',
  hospitalCash: 'Hospital Cash Rider',
  waiverOfPremiumDisability: 'Waiver of Premium - Disability',
  waiverOfPremiumCriticalIllness: 'Waiver of Premium - Critical Illness',
  familyIncomeBenefit: 'Family Income Benefit Rider',
  guaranteedIncome: 'Guaranteed Income Rider',
} as const;

/** Row index for each rider, so tests can address them directly when needed. */
export const riderIndex = {
  [riders.accidentalDeath]: 1,
  [riders.permanentDisability]: 2,
  [riders.termRider]: 3,
  [riders.criticalIllness]: 4,
  [riders.hospitalCash]: 5,
  [riders.waiverOfPremiumDisability]: 6,
  [riders.waiverOfPremiumCriticalIllness]: 7,
  [riders.familyIncomeBenefit]: 8,
  [riders.guaranteedIncome]: 9,
} as const;

/**
 * The two waiver riders expected to be mutually exclusive (R-RIDER-02).
 * Both waive future premiums, so attaching both is double cover for one event.
 */
export const mutuallyExclusiveWaivers: [string, string] = [
  riders.waiverOfPremiumDisability,
  riders.waiverOfPremiumCriticalIllness,
];

/** Document type enum values (confirmed). */
export const documentTypes = {
  idProof: 'KYC_ID',
  addressProof: 'ADDRESS_PROOF',
  incomeProof: 'INCOME_PROOF',
  other: 'OTHER',
} as const;

/** The four seeded Whole Life products, with their select values. */
export const products = {
  secureLife: { id: '1', name: 'SecureLife Whole Life', code: 'WL_SECURE_BASIC' },
  wealthBuilder: { id: '2', name: 'WealthBuilder Whole Life', code: 'WL_WEALTH_BUILDER' },
  eliteLegacy: { id: '3', name: 'Elite Legacy Whole Life', code: 'WL_ELITE_LEGACY' },
  flexiPay: { id: '4', name: 'FlexiPay Whole Life', code: 'WL_FLEXI_PAY' },
} as const;

export const expectedProducts = Object.values(products).map((p) => p.name);
export const expectedProductCodes = Object.values(products).map((p) => p.code);

/** Premium frequency enum values (confirmed). */
export const premiumFrequencies = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const;
