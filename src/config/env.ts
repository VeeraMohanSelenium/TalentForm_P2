import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Single point of configuration.
 *
 * No test, page object or helper reads process.env directly, and nothing in this
 * suite hard-codes a URL, credential or application ID. That is Assignment 2
 * section 6 ("configuration separated from test logic") and common mistake 3
 * ("hard-coding credentials, URLs or application IDs in many files").
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env and fill it in. See README section "Configuration".`,
    );
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

/**
 * BASE_URL is deliberately required rather than defaulted. Which port serves the
 * insurance application versus FinServe is still unconfirmed (question Q-02 from
 * Submission 1), so a wrong default would silently point the whole suite at the
 * wrong application.
 */
export const env = {
  baseUrl: required('BASE_URL'),
  apiBaseUrl: optional('API_BASE_URL', `${required('BASE_URL')}/api`),

  agent: {
    username: required('AGENT_USERNAME'),
    password: required('AGENT_PASSWORD'),
  },

  /** Second agent — mandatory for data isolation tests R-DASH-01 and R-DOC-05. */
  secondAgent: {
    username: optional('SECOND_AGENT_USERNAME', ''),
    password: optional('SECOND_AGENT_PASSWORD', ''),
  },

  /** Locked agent — see Q-09 regarding the unlock route. */
  lockedAgent: {
    username: optional('LOCKED_AGENT_USERNAME', ''),
    password: optional('LOCKED_AGENT_PASSWORD', ''),
  },

  newAgent: {
    username: optional('NEW_AGENT_USERNAME', ''),
    password: optional('NEW_AGENT_PASSWORD', ''),
  },

  /** Deterministic OTP for MFA simulation, if the lab provides one (Q-10). */
  otp: optional('TEST_OTP', ''),

  /** Read-only database access for backend verification (Q-04). */
  db: {
    enabled: bool('DB_ENABLED', false),
    host: optional('DB_HOST', ''),
    port: num('DB_PORT', 3306),
    name: optional('DB_NAME', ''),
    user: optional('DB_USER', ''),
    password: optional('DB_PASSWORD', ''),
  },

  /** Business rule values. Defaults follow assumption A-04; confirm via Q-08. */
  rules: {
    minAge: num('RULE_MIN_AGE', 18),
    maxAge: num('RULE_MAX_AGE', 65),
    maxUploadMb: num('RULE_MAX_UPLOAD_MB', 5),
    maxRiders: num('RULE_MAX_RIDERS', 3),
    ageBoundsInclusive: bool('RULE_AGE_BOUNDS_INCLUSIVE', true),
  },

  /** Seeded defect switch state, if the lab exposes one (Q-07). */
  defectProfile: optional('DEFECT_PROFILE', 'unknown'),
} as const;

/** True when enough configuration exists to run database assertions. */
export const dbAvailable = (): boolean =>
  env.db.enabled && env.db.host !== '' && env.db.name !== '' && env.db.user !== '';

/** True when a second agent account has been supplied. */
export const secondAgentAvailable = (): boolean => env.secondAgent.username !== '';

/** True when a locked agent account has been supplied. */
export const lockedAgentAvailable = (): boolean => env.lockedAgent.username !== '';

/** True when a new / empty agent account has been supplied. */
export const newAgentAvailable = (): boolean => env.newAgent.username !== '';
