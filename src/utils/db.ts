import { dbAvailable, env } from '../config/env';

/**
 * Read-only database verification.
 *
 * Some risks cannot be proven from the browser: an SSN can be masked on screen
 * and stored in clear, a beneficiary can vanish from the page and remain in the
 * table, a status can display correctly and be wrong in the record
 * (Study and QA Plan, section 8.4).
 *
 * Two rules are enforced here:
 *   1. Read-only. Test data is created through the UI or the API, never by direct
 *      insert, so the application's own validation and persistence path is what
 *      is under test. `query()` refuses anything that is not a SELECT.
 *   2. Optional. Read access has been requested but not granted (question Q-04).
 *      Until DB_ENABLED is set, `dbAvailable()` is false and the tests that need
 *      it skip themselves rather than fail.
 *
 * A driver is deliberately NOT a dependency of this project yet, because the
 * database engine has not been confirmed. Once it is, install the matching driver
 * (mysql2 for MySQL/MariaDB, pg for PostgreSQL) and implement `runQuery` below.
 * Everything that calls into this module is already written against this shape.
 */

export interface QueryResult {
  rows: Record<string, unknown>[];
  sql: string;
  /** Human-readable form, attached to the report as defect evidence. */
  evidence: string;
}

const SELECT_ONLY = /^\s*select\s/i;

export async function query(sql: string, params: unknown[] = []): Promise<QueryResult> {
  if (!SELECT_ONLY.test(sql)) {
    throw new Error(
      'Only SELECT statements are permitted. Test data must be created through the ' +
        'UI or API so the application\'s own persistence path is what is exercised.',
    );
  }
  if (!dbAvailable()) {
    throw new Error(
      'Database access is not configured. Set DB_ENABLED=true and the DB_* variables ' +
        'in .env once read-only credentials are granted (question Q-04). ' +
        'Tests that need the database should guard with test.skip(!dbAvailable()).',
    );
  }

  const rows = await runQuery(sql, params);
  return {
    rows,
    sql,
    evidence: formatEvidence(sql, params, rows),
  };
}

/**
 * Driver binding. Not implemented until the database engine is confirmed (Q-04).
 *
 * Reference implementation for MySQL, once `mysql2` is installed:
 *
 *   const mysql = await import('mysql2/promise');
 *   const conn = await mysql.createConnection({
 *     host: env.db.host, port: env.db.port, database: env.db.name,
 *     user: env.db.user, password: env.db.password,
 *   });
 *   try {
 *     const [rows] = await conn.execute(sql, params);
 *     return rows as Record<string, unknown>[];
 *   } finally {
 *     await conn.end();
 *   }
 */
async function runQuery(_sql: string, _params: unknown[]): Promise<Record<string, unknown>[]> {
  throw new Error(
    `No database driver is installed. Confirm the engine (question Q-04), add the driver ` +
      `to package.json, then implement runQuery() in src/utils/db.ts. ` +
      `Configured target: ${env.db.host}:${env.db.port}/${env.db.name || '<unset>'}`,
  );
}

function formatEvidence(sql: string, params: unknown[], rows: Record<string, unknown>[]): string {
  const header = [
    `-- executed ${new Date().toISOString()}`,
    `-- against ${env.db.host}:${env.db.port}/${env.db.name}`,
    sql.trim(),
    params.length ? `-- params: ${JSON.stringify(params)}` : '',
    `-- ${rows.length} row(s)`,
    '',
  ]
    .filter(Boolean)
    .join('\n');

  if (rows.length === 0) return `${header}(no rows)`;

  const cols = Object.keys(rows[0]);
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)),
  );
  const line = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i])).join(' | ');

  return [
    header,
    line(cols),
    widths.map((w) => '-'.repeat(w)).join('-+-'),
    ...rows.map((r) => line(cols.map((c) => String(r[c] ?? '')))),
  ].join('\n');
}

// ---------------------------------------------------------------- named checks
// Each maps to a specific risk in the Submission 1 register. Table and column
// names are provisional — see section 6.3 of the Study and QA Plan.

/** R-KYC-01 / TC-KYC-001: is the SSN stored in clear? */
export const ssnForApplication = (applicationId: string) =>
  query('SELECT ssn FROM clients WHERE application_id = ?', [applicationId]);

/** R-KYC-05 / TC-KYC-004: did the PEP flag persist? */
export const pepFlagForApplication = (applicationId: string) =>
  query('SELECT is_pep, pep_details FROM kyc_details WHERE application_id = ?', [applicationId]);

/** R-BEN-08: do removed beneficiaries linger in the table? */
export const beneficiariesForApplication = (applicationId: string) =>
  query(
    'SELECT id, first_name, last_name, allocation, deleted_at FROM beneficiaries WHERE application_id = ?',
    [applicationId],
  );

/** R-WF-06: is the reference number stored, and is it unique? */
export const referenceForApplication = (applicationId: string) =>
  query('SELECT reference_number, status FROM applications WHERE id = ?', [applicationId]);

/** R-WF-07: does the status history show a valid transition sequence? */
export const statusHistoryForApplication = (applicationId: string) =>
  query(
    'SELECT status, created_at FROM application_status_history WHERE application_id = ? ORDER BY created_at',
    [applicationId],
  );

/** R-PROD-06: does the persisted premium frequency match what was selected? */
export const policyConfigForApplication = (applicationId: string) =>
  query(
    'SELECT face_value, premium_frequency, payment_term, policy_term FROM application_products WHERE application_id = ?',
    [applicationId],
  );

/** R-AUTH-02: is the lock flag and attempt counter maintained? */
export const agentLockState = (username: string) =>
  query('SELECT username, failed_attempts, locked_at FROM users WHERE username = ?', [username]);
