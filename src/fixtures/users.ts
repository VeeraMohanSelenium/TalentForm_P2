import { env, lockedAgentAvailable, newAgentAvailable, secondAgentAvailable } from '../config/env';

/**
 * The user roles the coverage requires, from section 4.1 of the Study and QA Plan.
 *
 * Credentials come from the environment, never from this file. Roles whose
 * accounts have not been supplied report `available: false`, and the tests that
 * need them skip with a clear reason rather than failing on a blank password.
 */

export interface TestUser {
  role: string;
  username: string;
  password: string;
  available: boolean;
  /** Why the role exists, so a skipped test explains itself in the report. */
  purpose: string;
}

export const users = {
  /** Active, fully onboarded. Used by almost every flow. */
  agent: {
    role: 'Valid agent',
    username: env.agent.username,
    password: env.agent.password,
    available: true,
    purpose: 'Happy-path E2E, draft and resume, submission',
  } satisfies TestUser,

  /** Required for data isolation — R-DASH-01 and R-DOC-05 cannot be tested with one account. */
  secondAgent: {
    role: 'Second valid agent',
    username: env.secondAgent.username,
    password: env.secondAgent.password,
    available: secondAgentAvailable(),
    purpose: 'Data isolation between agents (R-DASH-01, R-DOC-05)',
  } satisfies TestUser,

  /** Locked after failed attempts. See Q-09 for the unlock route. */
  lockedAgent: {
    role: 'Locked agent',
    username: env.lockedAgent.username,
    password: env.lockedAgent.password,
    available: lockedAgentAvailable(),
    purpose: 'Lockout messaging and access denial (R-AUTH-03)',
  } satisfies TestUser,

  /** Registered with no applications. */
  newAgent: {
    role: 'New agent',
    username: env.newAgent.username,
    password: env.newAgent.password,
    available: newAgentAvailable(),
    purpose: 'Empty dashboard state (R-DASH-05)',
  } satisfies TestUser,

  /** Does not exist. The error must not reveal whether the account is real. */
  unknownUser: {
    role: 'Invalid user',
    username: 'no.such.agent@example.test',
    password: 'NotARealPassword123!',
    available: true,
    purpose: 'Negative authentication (R-AUTH-01)',
  } satisfies TestUser,
} as const;

/** A wrong password for a real account, for the invalid-credential and lockout tests. */
export const WRONG_PASSWORD = 'DeliberatelyWrong!123';

/** Passwords that must be refused by the password policy (R-AUTH-04). */
export const WEAK_PASSWORDS = [
  'abc',
  '12345678',
  'password',
  'aaaaaaaa',
  'Password',
];

/** Standard skip reason, so the HTML report explains why a test did not run. */
export function unavailableReason(user: TestUser): string {
  return (
    `${user.role} account not configured. Set the matching variables in .env ` +
    `(see .env.example). Needed for: ${user.purpose}.`
  );
}
