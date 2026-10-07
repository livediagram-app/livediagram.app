// Workbench rows (migration 0077; docs/specs/013-workspace/blueprints/workbench-embeds.md "Data and
// persistence"): pairing requests, pairings, tickets and sessions. Hash-agnostic: callers hash secrets
// before they reach here, so no secret ever touches a query.

import {
  WORKBENCH_PAIRING_TTL_MS,
  WORKBENCH_SESSION_GRACE_MS,
  type InvalidTicketReason,
  type PairingRequestStatus,
  type WorkbenchPairing,
  type WorkbenchRole,
} from '@livediagram/api-schema';
import type { Env } from '../types';

// ---------------------------------------------------------------------
// Pairing requests
// ---------------------------------------------------------------------

export type OpenPairingRequestInput = {
  ownerId: string;
  tokenId: string;
  origin: string;
  // Replaces the stored name when given; null keeps it.
  name: string | null;
  // The code a new request takes; ignored when a live one is reused.
  code: string;
  now: number;
};

type RequestRow = {
  code: string;
  owner_id: string;
  token_id: string;
  origin: string;
  name: string | null;
  status: 'pending' | 'approved' | 'declined';
  expires_at: number;
};

async function livePairingRequest(
  env: Env,
  tokenId: string,
  origin: string,
): Promise<RequestRow | null> {
  return env.DB.prepare(
    `SELECT code, owner_id, token_id, origin, name, status, expires_at FROM workbench_pairing_requests
      WHERE token_id = ? AND origin = ? AND status = 'pending'`,
  )
    .bind(tokenId, origin)
    .first<RequestRow>();
}

// The one live request for a token and origin: reused while it lives (taking a given name), replaced once
// it has expired. The partial unique index keeps a race to one row; the loser reads the winner's.
export async function openPairingRequest(
  env: Env,
  input: OpenPairingRequestInput,
): Promise<{ code: string; expiresAt: number; reused: boolean }> {
  const { ownerId, tokenId, origin, name, code, now } = input;
  await env.DB.prepare(
    `DELETE FROM workbench_pairing_requests
      WHERE token_id = ? AND origin = ? AND status = 'pending' AND expires_at <= ?`,
  )
    .bind(tokenId, origin, now)
    .run();
  const expiresAt = now + WORKBENCH_PAIRING_TTL_MS;
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO workbench_pairing_requests
       (id, code, owner_id, token_id, origin, name, status, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(crypto.randomUUID(), code, ownerId, tokenId, origin, name, now, expiresAt)
    .run();
  if ((inserted.meta?.changes ?? 0) > 0) return { code, expiresAt, reused: false };
  const live = await livePairingRequest(env, tokenId, origin);
  if (!live) throw new Error('workbench: no live pairing request after a refused insert');
  if (name !== null && name !== live.name) {
    await env.DB.prepare('UPDATE workbench_pairing_requests SET name = ? WHERE code = ?')
      .bind(name, live.code)
      .run();
  }
  return { code: live.code, expiresAt: live.expires_at, reused: true };
}

function effectiveStatus(row: { status: RequestRow['status']; expires_at: number }, now: number) {
  return (
    row.status === 'pending' && row.expires_at <= now ? 'expired' : row.status
  ) as PairingRequestStatus;
}

export type PairingRequestRead = {
  ownerId: string;
  tokenId: string;
  origin: string;
  name: string | null;
  tokenName: string | null;
  expiresAt: number;
  status: PairingRequestStatus;
};

export async function readPairingRequest(
  env: Env,
  code: string,
  now: number,
): Promise<PairingRequestRead | null> {
  const row = await env.DB.prepare(
    `SELECT r.owner_id, r.token_id, r.origin, r.name, r.status, r.expires_at, t.name AS token_name
       FROM workbench_pairing_requests r JOIN api_tokens t ON t.id = r.token_id
      WHERE r.code = ?`,
  )
    .bind(code)
    .first<RequestRow & { token_name: string | null }>();
  if (!row) return null;
  return {
    ownerId: row.owner_id,
    tokenId: row.token_id,
    origin: row.origin,
    name: row.name,
    tokenName: row.token_name,
    expiresAt: row.expires_at,
    status: effectiveStatus(row, now),
  };
}

export type PairingAnswer =
  | { outcome: 'approved'; pairing: WorkbenchPairing }
  | { outcome: 'declined' }
  | { outcome: 'missing' }
  | { outcome: 'answered' }
  | { outcome: 'expired' };

// Answered once by the token's owner. Approval flips the request and records the pairing in one batch; the
// insert reads the request it just flipped (by its answer time), so a lost race records nothing.
export async function answerPairingRequest(
  env: Env,
  input: {
    code: string;
    ownerId: string;
    answer: 'approve' | 'decline';
    pairingId: string;
    now: number;
  },
): Promise<PairingAnswer> {
  const { code, ownerId, answer, pairingId, now } = input;
  const request = await readPairingRequest(env, code, now);
  if (!request || request.ownerId !== ownerId) return { outcome: 'missing' };
  if (request.status === 'expired') return { outcome: 'expired' };
  if (request.status !== 'pending') return { outcome: 'answered' };
  const flip = env.DB.prepare(
    `UPDATE workbench_pairing_requests SET status = ?, answered_at = ?
      WHERE code = ? AND status = 'pending' AND expires_at > ?`,
  ).bind(answer === 'approve' ? 'approved' : 'declined', now, code, now);
  if (answer === 'decline') {
    const res = await flip.run();
    return (res.meta?.changes ?? 0) > 0 ? { outcome: 'declined' } : { outcome: 'answered' };
  }
  const record = env.DB.prepare(
    `INSERT OR IGNORE INTO workbench_pairings (id, owner_id, token_id, origin, name, created_at)
     SELECT ?, owner_id, token_id, origin, name, ? FROM workbench_pairing_requests
      WHERE code = ? AND status = 'approved' AND answered_at = ?`,
  ).bind(pairingId, now, code, now);
  const [flipped] = await env.DB.batch([flip, record]);
  if ((flipped?.meta?.changes ?? 0) === 0) return { outcome: 'answered' };
  const pairing = await findWorkbenchPairing(env, request.tokenId, request.origin);
  if (!pairing) throw new Error('workbench: approved request recorded no pairing');
  return { outcome: 'approved', pairing };
}

// The waiting CLI's poll: only the token that asked may read its request.
export async function pairingRequestStatus(
  env: Env,
  code: string,
  tokenId: string,
  now: number,
): Promise<{ status: PairingRequestStatus; expiresAt: number } | null> {
  const row = await env.DB.prepare(
    'SELECT status, expires_at FROM workbench_pairing_requests WHERE code = ? AND token_id = ?',
  )
    .bind(code, tokenId)
    .first<{ status: RequestRow['status']; expires_at: number }>();
  return row ? { status: effectiveStatus(row, now), expiresAt: row.expires_at } : null;
}

// ---------------------------------------------------------------------
// Pairings
// ---------------------------------------------------------------------

type PairingRow = {
  id: string;
  token_id: string;
  origin: string;
  name: string | null;
  created_at: number;
};

const toPairing = (row: PairingRow): WorkbenchPairing => ({
  id: row.id,
  tokenId: row.token_id,
  origin: row.origin,
  name: row.name,
  pairedAt: row.created_at,
});

export async function findWorkbenchPairing(
  env: Env,
  tokenId: string,
  origin: string,
): Promise<WorkbenchPairing | null> {
  const row = await env.DB.prepare(
    'SELECT id, token_id, origin, name, created_at FROM workbench_pairings WHERE token_id = ? AND origin = ?',
  )
    .bind(tokenId, origin)
    .first<PairingRow>();
  return row ? toPairing(row) : null;
}

// The owner's pairings of tokens still live, newest first (Settings > API tokens).
export async function listWorkbenchPairings(
  env: Env,
  ownerId: string,
  now: number,
): Promise<WorkbenchPairing[]> {
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.token_id, p.origin, p.name, p.created_at
       FROM workbench_pairings p JOIN api_tokens t ON t.id = p.token_id
      WHERE p.owner_id = ? AND t.revoked = 0 AND t.expires_at > ?
      ORDER BY p.created_at DESC, p.id`,
  )
    .bind(ownerId, now)
    .all<PairingRow>();
  return results.map(toPairing);
}

// ---------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------

export type WorkbenchTicketRow = {
  ticketHash: string;
  ownerId: string;
  tokenId: string;
  pairingId: string;
  documentId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchRole;
  createdAt: number;
  expiresAt: number;
};

export async function insertWorkbenchTicket(env: Env, row: WorkbenchTicketRow): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO workbench_tickets
       (ticket_hash, owner_id, token_id, pairing_id, document_id, tab_id, origin, role, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.ticketHash,
      row.ownerId,
      row.tokenId,
      row.pairingId,
      row.documentId,
      row.tabId,
      row.origin,
      row.role,
      row.createdAt,
      row.expiresAt,
    )
    .run();
}

export type ConsumedTicket = {
  ownerId: string;
  tokenId: string;
  pairingId: string;
  documentId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchRole;
  tokenExpiresAt: number;
  tokenReadOnly: boolean;
};

// Single use in one statement (the `used_at IS NULL` guard). A ticket whose token is no longer live reads
// as unknown: its pairing cascades away with the token's revocation, and the answer leaks nothing more.
export async function consumeWorkbenchTicket(
  env: Env,
  ticketHash: string,
  now: number,
): Promise<{ ok: true; ticket: ConsumedTicket } | { ok: false; reason: InvalidTicketReason }> {
  const row = await env.DB.prepare(
    `UPDATE workbench_tickets SET used_at = ?
      WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?
      RETURNING owner_id, token_id, pairing_id, document_id, tab_id, origin, role`,
  )
    .bind(now, ticketHash, now)
    .first<{
      owner_id: string;
      token_id: string;
      pairing_id: string;
      document_id: string;
      tab_id: string | null;
      origin: string;
      role: WorkbenchRole;
    }>();
  if (!row) {
    const seen = await env.DB.prepare(
      'SELECT used_at, expires_at FROM workbench_tickets WHERE ticket_hash = ?',
    )
      .bind(ticketHash)
      .first<{ used_at: number | null; expires_at: number }>();
    if (!seen) return { ok: false, reason: 'unknown' };
    return { ok: false, reason: seen.used_at !== null ? 'used' : 'expired' };
  }
  const token = await env.DB.prepare(
    'SELECT expires_at, read_only FROM api_tokens WHERE id = ? AND revoked = 0 AND expires_at > ?',
  )
    .bind(row.token_id, now)
    .first<{ expires_at: number; read_only: number }>();
  if (!token) return { ok: false, reason: 'unknown' };
  return {
    ok: true,
    ticket: {
      ownerId: row.owner_id,
      tokenId: row.token_id,
      pairingId: row.pairing_id,
      documentId: row.document_id,
      tabId: row.tab_id,
      origin: row.origin,
      role: row.role,
      tokenExpiresAt: token.expires_at,
      tokenReadOnly: token.read_only === 1,
    },
  };
}

// ---------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------

export type WorkbenchSessionRow = {
  id: string;
  secretHash: string;
  ownerId: string;
  tokenId: string;
  pairingId: string;
  documentId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchRole;
  createdAt: number;
  expiresAt: number;
};

export async function insertWorkbenchSession(env: Env, row: WorkbenchSessionRow): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO workbench_sessions
       (id, secret_hash, owner_id, token_id, pairing_id, document_id, tab_id, origin, role, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      row.id,
      row.secretHash,
      row.ownerId,
      row.tokenId,
      row.pairingId,
      row.documentId,
      row.tabId,
      row.origin,
      row.role,
      row.createdAt,
      row.expiresAt,
    )
    .run();
}

export type WorkbenchSessionRead = WorkbenchSessionRow & {
  tokenRevoked: boolean;
  tokenReadOnly: boolean;
  tokenExpiresAt: number;
};

// One indexed read per `lvw_` request, with the token's state so the caller can classify a refusal.
export async function readWorkbenchSession(
  env: Env,
  secretHash: string,
): Promise<WorkbenchSessionRead | null> {
  const row = await env.DB.prepare(
    `SELECT s.id, s.secret_hash, s.owner_id, s.token_id, s.pairing_id, s.document_id, s.tab_id, s.origin,
            s.role, s.created_at, s.expires_at,
            t.revoked AS token_revoked, t.read_only AS token_read_only, t.expires_at AS token_expires_at
       FROM workbench_sessions s JOIN api_tokens t ON t.id = s.token_id
      WHERE s.secret_hash = ?`,
  )
    .bind(secretHash)
    .first<{
      id: string;
      secret_hash: string;
      owner_id: string;
      token_id: string;
      pairing_id: string;
      document_id: string;
      tab_id: string | null;
      origin: string;
      role: WorkbenchRole;
      created_at: number;
      expires_at: number;
      token_revoked: number;
      token_read_only: number;
      token_expires_at: number;
    }>();
  if (!row) return null;
  return {
    id: row.id,
    secretHash: row.secret_hash,
    ownerId: row.owner_id,
    tokenId: row.token_id,
    pairingId: row.pairing_id,
    documentId: row.document_id,
    tabId: row.tab_id,
    origin: row.origin,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    tokenRevoked: row.token_revoked === 1,
    tokenReadOnly: row.token_read_only === 1,
    tokenExpiresAt: row.token_expires_at,
  };
}

export async function deleteWorkbenchSession(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM workbench_sessions WHERE id = ?').bind(id).run();
}

// ---------------------------------------------------------------------
// Retention (the daily run)
// ---------------------------------------------------------------------

// Tickets and requests past expiry, sessions past their grace, pairings of tokens no longer live.
export async function sweepWorkbench(env: Env, now: number): Promise<number> {
  const results = await env.DB.batch([
    env.DB.prepare('DELETE FROM workbench_tickets WHERE expires_at <= ?').bind(now),
    env.DB.prepare('DELETE FROM workbench_pairing_requests WHERE expires_at <= ?').bind(now),
    env.DB.prepare('DELETE FROM workbench_sessions WHERE expires_at <= ?').bind(
      now - WORKBENCH_SESSION_GRACE_MS,
    ),
    env.DB.prepare(
      `DELETE FROM workbench_pairings WHERE token_id IN
         (SELECT id FROM api_tokens WHERE revoked = 1 OR expires_at <= ?)`,
    ).bind(now),
  ]);
  return results.reduce((sum, r) => sum + (r.meta?.changes ?? 0), 0);
}
