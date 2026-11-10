// The workbench store's larger statements (liveworkspace/docs/specs/011-workbench/workbench.md "The store"), over its
// SQLite: recording an approved pairing, a ticket, a session and an allowance's uses, and finding what lapses. Each
// takes the store's `sql` and leaves the alarm to the store (store.ts), which schedules it after a write.

import {
  type PairingRequestRead,
  type SqlExec,
  WORKBENCH_QUOTA_MAX,
  WORKBENCH_SESSION_GRACE_MS,
  type WorkbenchLevel,
  type WorkbenchPairingRow,
  type WorkbenchReach,
  type WorkbenchScope,
} from './store-types.ts';
import type { Row } from './store-schema.ts';

// What a ticket or a session is minted for: a pairing's reach, a tab, a role, and when it lapses.
export type GrantInput = {
  reach: WorkbenchReach;
  tabId: string | null;
  role: WorkbenchLevel;
  now: number;
  expiresAt: number;
};

const firstOf = (sql: SqlExec, query: string, ...bindings: unknown[]) =>
  sql.exec(query, ...bindings).toArray()[0] ?? null;

// What a pairing request is opened for: an app, a token, an origin and a scope, and the name it asks for.
export type PairingRequestInput = {
  app: string;
  tokenId: string;
  origin: string;
  scope: WorkbenchScope;
  name: string | null;
  now: number;
};

// The one live request for an app, token, origin and scope, once an expired one is cleared away, or null.
export function livePairingRequest(sql: SqlExec, input: PairingRequestInput): Row | null {
  const { app, tokenId, origin, scope, now } = input;
  sql.exec(
    `DELETE FROM wb_pairing_requests
      WHERE app = ? AND token_id = ? AND origin = ? AND scope = ? AND status = 'pending' AND expires_at <= ?`,
    app,
    tokenId,
    origin,
    scope,
    now,
  );
  return firstOf(
    sql,
    `SELECT code, name, expires_at FROM wb_pairing_requests
      WHERE app = ? AND token_id = ? AND origin = ? AND scope = ? AND status = 'pending'`,
    app,
    tokenId,
    origin,
    scope,
  );
}

// A new pending request under `code`, lapsing at `expiresAt`.
export function insertPairingRequest(
  sql: SqlExec,
  code: string,
  input: PairingRequestInput,
  expiresAt: number,
): void {
  const { app, tokenId, origin, scope, name, now } = input;
  sql.exec(
    `INSERT INTO wb_pairing_requests (code, app, token_id, origin, name, scope, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    code,
    app,
    tokenId,
    origin,
    name,
    scope,
    now,
    expiresAt,
  );
}

// An approved request's pairing. A workspace approval on an origin already paired for the item scope widens that
// pairing in place (same id, its name kept unless the request names one); an item approval never narrows a
// workspace pairing.
export function recordApprovedPairing(
  sql: SqlExec,
  request: PairingRequestRead,
  now: number,
): void {
  sql.exec(
    `INSERT INTO wb_pairings (id, app, token_id, origin, name, scope, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (app, token_id, origin) DO UPDATE
       SET scope = 'workspace', name = COALESCE(excluded.name, wb_pairings.name)
       WHERE excluded.scope = 'workspace'`,
    crypto.randomUUID(),
    request.app,
    request.tokenId,
    request.origin,
    request.name,
    request.scope,
    now,
  );
}

// A ticket's row, by its hash: the plaintext is never stored.
export function insertTicket(
  sql: SqlExec,
  ticketHash: string,
  pairing: WorkbenchPairingRow,
  input: GrantInput,
): void {
  const { reach, tabId, role, now, expiresAt } = input;
  sql.exec(
    `INSERT INTO wb_tickets
       (ticket_hash, app, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role, created_at,
        expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ticketHash,
    pairing.app,
    pairing.tokenId,
    pairing.id,
    reach.scope,
    reach.itemId,
    reach.folderId,
    tabId,
    pairing.origin,
    role,
    now,
    expiresAt,
  );
}

// A session's row, by its secret's hash.
export function insertSession(
  sql: SqlExec,
  id: string,
  secretHash: string,
  pairing: WorkbenchPairingRow,
  input: GrantInput,
): void {
  const { reach, tabId, role, now, expiresAt } = input;
  sql.exec(
    `INSERT INTO wb_sessions
       (id, secret_hash, app, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role, created_at,
        expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    secretHash,
    pairing.app,
    pairing.tokenId,
    pairing.id,
    reach.scope,
    reach.itemId,
    reach.folderId,
    tabId,
    pairing.origin,
    role,
    now,
    expiresAt,
  );
}

// An allowance's cap and window, and the uses asked for, checked before the store is touched.
export function checkQuotaInput(max: number, windowMs: number, count: number): void {
  if (!Number.isInteger(max) || max < 1 || max > WORKBENCH_QUOTA_MAX || !(windowMs > 0)) {
    throw new Error('workbench: an allowance needs a cap of 1 to 1,000 and a window');
  }
  if (!Number.isInteger(count) || count < 1) throw new Error('workbench: take at least one use');
}

// Takes up to `count` uses of `kind`, at most `max` in any `windowMs`, and answers how many it took; none are written
// past the cap.
export function takeQuotaUses(
  sql: SqlExec,
  input: { kind: string; max: number; windowMs: number; now: number; count: number },
): number {
  const { kind, max, windowMs, now, count } = input;
  sql.exec('DELETE FROM wb_quota WHERE kind = ? AND at <= ?', kind, now - windowMs);
  const used = Number(
    firstOf(sql, 'SELECT COUNT(*) AS n FROM wb_quota WHERE kind = ?', kind)?.n ?? 0,
  );
  const taken = Math.max(0, Math.min(count, max - used));
  if (taken === 0) return 0;
  sql.exec(
    `INSERT INTO wb_quota (kind, at, until)
     WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)
     SELECT ?, ?, ? FROM n`,
    taken,
    kind,
    now,
    now + windowMs,
  );
  return taken;
}

// The next moment something here lapses (a ticket, a request, a session past its grace, an allowance use), or null
// when nothing will. Pairings never lapse on their own.
export function nextLapseOf(sql: SqlExec): number | null {
  const row = firstOf(
    sql,
    `SELECT MIN(at) AS at FROM (
       SELECT MIN(expires_at) AS at FROM wb_tickets
       UNION ALL SELECT MIN(expires_at) FROM wb_pairing_requests
       UNION ALL SELECT MIN(expires_at) + ? FROM wb_sessions
       UNION ALL SELECT MIN(until) FROM wb_quota)`,
    WORKBENCH_SESSION_GRACE_MS,
  );
  return typeof row?.at === 'number' ? row.at : null;
}

// Whether the store holds any row at all; one left with none deletes itself.
export function hasRows(sql: SqlExec): boolean {
  return (
    firstOf(
      sql,
      `SELECT 1 FROM wb_pairings UNION ALL SELECT 1 FROM wb_pairing_requests UNION ALL SELECT 1 FROM wb_tickets
       UNION ALL SELECT 1 FROM wb_sessions UNION ALL SELECT 1 FROM wb_quota LIMIT 1`,
    ) !== null
  );
}

// What has lapsed: tickets and requests past their expiry, sessions past their grace, allowance uses past their
// window. Answers how many rows went.
export function sweepLapsed(sql: SqlExec, now: number): number {
  let deleted = 0;
  const run = (query: string, ...bindings: unknown[]) => {
    deleted += sql.exec(`${query} RETURNING 1`, ...bindings).toArray().length;
  };
  run('DELETE FROM wb_tickets WHERE expires_at <= ?', now);
  run('DELETE FROM wb_pairing_requests WHERE expires_at <= ?', now);
  run('DELETE FROM wb_sessions WHERE expires_at <= ?', now - WORKBENCH_SESSION_GRACE_MS);
  run('DELETE FROM wb_quota WHERE until <= ?', now);
  return deleted;
}
