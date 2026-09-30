import { env } from '../config/env';

/**
 * Generates unique, valid-by-construction test data.
 *
 * Every test that creates an application generates its own data with a unique
 * run suffix, so tests stay independent and can run in parallel (Study and QA
 * Plan, section 4.2). Nothing here reads or mutates shared seed data.
 */

let counter = 0;

/** Short unique token, stable within a process, unique across parallel workers. */
export function uniqueToken(): string {
  counter += 1;
  const worker = process.env.TEST_WORKER_INDEX ?? '0';
  return `${Date.now().toString(36)}${worker}${counter.toString(36)}`;
}

// ---------------------------------------------------------------- dates

/** Formats a Date as YYYY-MM-DD. Adjust here if the application expects another format. */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** A date of birth that makes the person exactly `years` old today. */
export function dobForExactAge(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return toISODate(d);
}

/** A DOB making the person `years` old plus an offset in days (negative = younger). */
export function dobForAgeOffsetDays(years: number, offsetDays: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setDate(d.getDate() + offsetDays);
  return toISODate(d);
}

/**
 * The boundary set fixed in Submission 1, section 4.2, so the same values appear
 * in the test cases and in the automation.
 */
export const dobBoundaries = {
  /** Exactly the minimum age â€” must be ACCEPTED under assumption A-04. */
  exactlyMinAge: () => dobForExactAge(env.rules.minAge),
  /** One day short of the minimum age â€” must be REJECTED. */
  justUnderMinAge: () => dobForAgeOffsetDays(env.rules.minAge, 1),
  /** Exactly the maximum age â€” must be ACCEPTED under assumption A-04. */
  exactlyMaxAge: () => dobForExactAge(env.rules.maxAge),
  /** One day past the maximum age â€” must be REJECTED. */
  justOverMaxAge: () => dobForAgeOffsetDays(env.rules.maxAge, -1),
  /** Tomorrow â€” must always be REJECTED (R-CLI-01). */
  future: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toISODate(d);
  },
  /** A comfortably valid DOB for happy-path tests. */
  valid: () => dobForExactAge(35),
};

/** Age in whole years implied by an ISO date string, computed the same way the UI should. */
export function ageFromISODate(iso: string): number {
  const dob = new Date(iso);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

// ---------------------------------------------------------------- people

export interface ClientData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  maritalStatus: string;
  nationality: string;
  occupation: string;
  employer: string;
  email: string;
  mobile: string;
  ssn: string;
}

/**
 * Enum values used by the application, confirmed against the live DOM on
 * 2026-09-17 (see select-options.md). The selects are uppercase enums whose
 * option text is not always the same as the value, so these are the values the
 * generators emit.
 */
export const ENUMS = {
  gender: ['MALE', 'FEMALE', 'NON_BINARY'] as const,
  maritalStatus: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'] as const,
  preferredContact: ['EMAIL', 'PHONE', 'MAIL'] as const,
  idType: ['SSN', 'STATE_ID', 'PASSPORT', 'DRIVERS_LICENSE'] as const,
  sourceOfFunds: ['SALARY', 'BUSINESS', 'INVESTMENTS', 'INHERITANCE'] as const,
  riskProfile: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] as const,
  premiumFrequency: ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'] as const,
  paymentTermYears: ['10', '15', '20', '25', '30'] as const,
  policyTerm: ['WHOLE_LIFE', 'TO_AGE_100'] as const,
  beneficiaryLevel: ['PRIMARY', 'SECONDARY'] as const,
  beneficiaryType: ['INDIVIDUAL', 'TRUST', 'ORGANIZATION'] as const,
  relationship: ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'TRUST', 'ORGANIZATION', 'OTHER'] as const,
  documentType: ['KYC_ID', 'ADDRESS_PROOF', 'INCOME_PROOF', 'OTHER'] as const,
} as const;

export function makeClient(overrides: Partial<ClientData> = {}): ClientData {
  const token = uniqueToken();
  return {
    firstName: `Test${token.slice(-5)}`,
    lastName: `Insured${token.slice(0, 4)}`,
    dob: dobBoundaries.valid(),
    gender: 'MALE',
    maritalStatus: 'SINGLE',
    nationality: 'United States',
    occupation: 'Software Engineer',
    employer: `Acme Corp ${token.slice(0, 3)}`,
    email: `qa.${token}@example.com`,
    mobile: '2125551212',
    // Synthetic only. Assumption A-08: no real personal data exists in the lab.
    ssn: '123456789',
    ...overrides,
  };
}

export interface AddressData {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export function makeAddress(overrides: Partial<AddressData> = {}): AddressData {
  return {
    line1: `${100 + (counter % 800)} Test Street`,
    line2: 'Suite 4',
    city: 'Springfield',
    state: 'MA',
    zip: '01103',
    ...overrides,
  };
}

/** A ZIP that does not belong to the given state, for the cross-field test TC-ADDR-004. */
export function mismatchedZipForState(state: string): string {
  return state === 'MA' ? '90210' : '01103';
}

export interface BeneficiaryData {
  firstName: string;
  lastName: string;
  dob: string;
  relationship: string;
  allocation: number;
  type: 'INDIVIDUAL' | 'TRUST' | 'ORGANIZATION';
}

export function makeBeneficiary(overrides: Partial<BeneficiaryData> = {}): BeneficiaryData {
  const token = uniqueToken();
  return {
    firstName: `Ben${token.slice(-4)}`,
    lastName: `Family${token.slice(0, 3)}`,
    dob: dobForExactAge(40),
    relationship: 'SPOUSE',
    allocation: 100,
    type: 'INDIVIDUAL',
    ...overrides,
  };
}

/** A beneficiary under 18, to force the guardian rule (R-BEN-02). */
export function makeMinorBeneficiary(overrides: Partial<BeneficiaryData> = {}): BeneficiaryData {
  return makeBeneficiary({ dob: dobForExactAge(10), relationship: 'CHILD', ...overrides });
}

/** Splits an allocation total across n beneficiaries, last one absorbing the remainder. */
export function splitAllocation(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const out = Array<number>(n).fill(base);
  out[n - 1] = total - base * (n - 1);
  return out;
}

export interface PolicyData {
  /**
   * Product label or code. Defaults to SecureLife (sum assured 100,000 - 1,000,000,
   * ages 18 - 65), the only product whose bands contain every default value here.
   * Leaving it to "first in the list" picked Elite Legacy (minimum 500,000), so the
   * product step silently refused to save.
   */
  product: string;
  faceValue: number;
  premiumFrequency: string;
  paymentTerm: string;
  policyTerm: string;
}

export function makePolicy(overrides: Partial<PolicyData> = {}): PolicyData {
  return {
    product: 'SecureLife Whole Life',
    faceValue: 250_000,
    premiumFrequency: 'ANNUAL',
    paymentTerm: '20',
    policyTerm: 'WHOLE_LIFE',
    ...overrides,
  };
}

export interface FinancialData {
  annualIncome: number;
  netWorth: number;
  sourceOfFunds: string;
  riskProfile: string;
  isPep: boolean;
  pepDetails: string;
}

export function makeFinancials(overrides: Partial<FinancialData> = {}): FinancialData {
  return {
    annualIncome: 180_000,
    netWorth: 750_000,
    sourceOfFunds: 'SALARY',
    riskProfile: 'MODERATE',
    isPep: false,
    pepDetails: '',
    ...overrides,
  };
}

/** Income deliberately too low for the premium, to trigger affordability (R-KYC-03). */
export function makeUnaffordableFinancials(): FinancialData {
  return makeFinancials({ annualIncome: 12_000, netWorth: 5_000, riskProfile: 'CONSERVATIVE' });
}
