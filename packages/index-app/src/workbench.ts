// Workbench embeds (each app's docs/specs/013-workspace/workbench-embeds.md): a person's API token pairs with a
// web origin once, then mints one-minute tickets that open an editor session in that origin's iframe. Everything
// a person's workbench holds (pairing requests, pairings, tickets, sessions, the rooms a workspace session
// joined, and what it knows of their tokens) lives in one Durable Object per person, in its own SQLite. No app
// keeps a database for it.
//
// Every route reaches the person's store by their id (`workbenchStoreOf`), except the two that have no one
// signed in: redeeming a ticket and presenting a session. Those secrets carry the store's id after a dot
// (`<random>.<64 hex>`), so `workbenchStoreOfSecret` reaches the store from the secret alone. The suffix is no
// credential: the store holds only the secret's SHA-256, so a forged suffix reaches a store that knows nothing
// of it.
//
// Ending access: Unpair removes one pairing, and a token revoked (by the CLI's logout, or on liveworkspace.app)
// removes all of its pairings and requests. Tickets, sessions and their rooms go with their pairing; the rooms
// the sessions had open are closed through the app's `closeRoom`. A token revoked on liveworkspace.app ends its
// sessions within five minutes: the store's alarm asks liveworkspace about the tokens that have live sessions.
// It also sweeps spent rows daily, and a store left with nothing deletes itself.

import {
  liveTokenIds,
  MAX_LIVE_TOKEN_IDS,
  type ClientCredentials,
} from '@liveworkspace/auth-client';
import type { Level } from '@liveworkspace/index-client';
import type { SqlExec } from './outbox';

// ---------- Constants -----------------------------------------------------------------------------------------

export const WORKBENCH_SESSION_PREFIX = 'lvw_';
// Random bytes in a ticket, a pairing code and a session secret, before any routing suffix.
export const WORKBENCH_TICKET_BYTES = 16;
export const WORKBENCH_PAIRING_CODE_BYTES = 16;
export const WORKBENCH_SESSION_SECRET_BYTES = 32;
// A pairing request waits this long for its answer.
export const WORKBENCH_PAIRING_TTL_MS = 10 * 60 * 1000;
// A session past its expiry is kept this long, so its refusal reads "expired" rather than "unknown".
export const WORKBENCH_SESSION_GRACE_MS = 24 * 60 * 60 * 1000;
// How often the store asks liveworkspace whether the tokens behind live sessions still work.
export const WORKBENCH_TOKEN_CHECK_MS = 5 * 60 * 1000;
// How often it sweeps spent rows and checks every paired token.
export const WORKBENCH_SWEEP_MS = 24 * 60 * 60 * 1000;
// Rooms closed at once when access ends.
export const WORKBENCH_CLOSE_CONCURRENCY = 10;

// A store's id as `DurableObjectId.toString()` gives it, after the secret's dot.
const ROUTE_SUFFIX = /\.([0-9a-f]{64})$/;
// A ticket: 16 random bytes as base64url, then the store's id.
export const WORKBENCH_TICKET_PATTERN = /^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/;
// A session: `lvw_`, 32 random bytes as base64url, then the store's id.
export const WORKBENCH_SESSION_PATTERN = /^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/;

// ---------- Secrets --------------------------------------------------------------------------------------------

export function randomBase64Url(bytes: number): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  for (const b of raw) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
  );
  let hex = '';
  for (const b of digest) hex += b.toString(16).padStart(2, '0');
  return hex;
}

// The store a routed secret names, or null for a secret with no suffix.
export function storeIdOfSecret(secret: string): string | null {
  return ROUTE_SUFFIX.exec(secret)?.[1] ?? null;
}

// The logged handle of a session: its id's first 8 characters, never the secret.
export const sessionPrefixOf = (sessionId: string) => sessionId.slice(0, 8);

// ---------- Types ----------------------------------------------------------------------------------------------

// What a ticket or session reaches: one item (the app's own scope name, e.g. 'project'), or the workspace from an
// optional folder.
export type WorkbenchReach<S extends string = string> =
  | { scope: S; itemId: string; folderId: null }
  | { scope: 'workspace'; itemId: null; folderId: string | null };

// A token as the app checked it with liveworkspace when it asked to pair or mint.
export type WorkbenchToken = {
  id: string;
  name: string | null;
  readOnly: boolean;
  expiresAt: number;
};

export type WorkbenchPairingRow<S extends string = string> = {
  id: string;
  tokenId: string;
  origin: string;
  name: string | null;
  scope: S | 'workspace';
  pairedAt: number;
};

export type PairingStatus = 'pending' | 'approved' | 'declined' | 'expired';

export type PairingRequestRead<S extends string = string> = {
  tokenId: string;
  origin: string;
  name: string | null;
  tokenName: string | null;
  scope: S | 'workspace';
  expiresAt: number;
  status: PairingStatus;
};

export type PairingAnswer<S extends string = string> =
  | { outcome: 'approved'; pairing: WorkbenchPairingRow<S>; asked: S | 'workspace' }
  | { outcome: 'declined'; tokenId: string; asked: S | 'workspace' }
  | { outcome: 'missing' }
  | { outcome: 'answered' }
  | { outcome: 'expired' };

export type InvalidTicketReason = 'unknown' | 'used' | 'expired';

export type ConsumedTicket<S extends string = string> = {
  ownerId: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  role: Level;
  tokenExpiresAt: number;
  tokenReadOnly: boolean;
} & WorkbenchReach<S>;

export type WorkbenchSessionRead<S extends string = string> = {
  id: string;
  ownerId: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  role: Level;
  createdAt: number;
  expiresAt: number;
  tokenRevoked: boolean;
  tokenReadOnly: boolean;
  tokenExpiresAt: number;
} & WorkbenchReach<S>;

export type WorkbenchEndTarget = { pairingId: string } | { tokenId: string };
export type WorkbenchEndReason = 'unpaired' | 'revoked' | 'closed';

// What a store asks of its app: liveworkspace's credentials (for the token check), and how to close the sessions
// of a pairing in one item's room. `fetcher` is for tests.
export type WorkbenchHooks = {
  credentials: () => ClientCredentials | null;
  closeRoom: (itemId: string, pairingId: string) => Promise<boolean>;
  fetcher?: typeof fetch;
};

// The slice of a Durable Object's storage the store uses.
export type WorkbenchStorage = {
  sql: SqlExec;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
  deleteAll(): Promise<void>;
};

// ---------- Schema ---------------------------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS wb_tokens (
  id         TEXT    PRIMARY KEY,
  name       TEXT,
  read_only  INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0,
  seen_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS wb_pairing_requests (
  code        TEXT    PRIMARY KEY,
  token_id    TEXT    NOT NULL,
  origin      TEXT    NOT NULL,
  name        TEXT,
  scope       TEXT    NOT NULL,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  answered_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS wb_pairing_requests_live
  ON wb_pairing_requests (token_id, origin, scope) WHERE status = 'pending';
CREATE TABLE IF NOT EXISTS wb_pairings (
  id         TEXT    PRIMARY KEY,
  token_id   TEXT    NOT NULL,
  origin     TEXT    NOT NULL,
  name       TEXT,
  scope      TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (token_id, origin)
);
CREATE TABLE IF NOT EXISTS wb_tickets (
  ticket_hash TEXT    PRIMARY KEY,
  token_id    TEXT    NOT NULL,
  pairing_id  TEXT    NOT NULL REFERENCES wb_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL,
  item_id     TEXT,
  folder_id   TEXT,
  tab_id      TEXT,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  CHECK ((scope = 'workspace') = (item_id IS NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE TABLE IF NOT EXISTS wb_sessions (
  id          TEXT    PRIMARY KEY,
  secret_hash TEXT    NOT NULL UNIQUE,
  token_id    TEXT    NOT NULL,
  pairing_id  TEXT    NOT NULL REFERENCES wb_pairings (id) ON DELETE CASCADE,
  scope       TEXT    NOT NULL,
  item_id     TEXT,
  folder_id   TEXT,
  tab_id      TEXT,
  origin      TEXT    NOT NULL,
  role        TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  CHECK ((scope = 'workspace') = (item_id IS NULL)),
  CHECK (scope = 'workspace' OR folder_id IS NULL)
);
CREATE INDEX IF NOT EXISTS wb_sessions_pairing ON wb_sessions (pairing_id);
CREATE TABLE IF NOT EXISTS wb_session_rooms (
  session_id TEXT NOT NULL REFERENCES wb_sessions (id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL,
  PRIMARY KEY (session_id, item_id)
);
CREATE TABLE IF NOT EXISTS wb_meta (
  key   TEXT PRIMARY KEY,
  value      NOT NULL
);
`;

type Row = Record<string, unknown>;

type ReachColumns = { scope: string; item_id: string | null; folder_id: string | null };

function reachOf<S extends string>(row: ReachColumns): WorkbenchReach<S> {
  if (row.scope === 'workspace')
    return { scope: 'workspace', itemId: null, folderId: row.folder_id };
  if (row.item_id === null) throw new Error('workbench: an item row with no item');
  return { scope: row.scope as S, itemId: row.item_id, folderId: null };
}

const toPairing = <S extends string>(row: Row): WorkbenchPairingRow<S> => ({
  id: row.id as string,
  tokenId: row.token_id as string,
  origin: row.origin as string,
  name: (row.name as string | null) ?? null,
  scope: row.scope as S,
  pairedAt: row.created_at as number,
});

const effectiveStatus = (status: string, expiresAt: number, now: number): PairingStatus =>
  status === 'pending' && expiresAt <= now ? 'expired' : (status as PairingStatus);

// ---------- The store ------------------------------------------------------------------------------------------

// One person's workbench. Every method is async, as it is over the Durable Object's RPC.
export class WorkbenchCore<S extends string = string> {
  readonly #storage: WorkbenchStorage;
  readonly #hooks: WorkbenchHooks;
  // The store's own id, the suffix of every secret it issues.
  readonly #id: string;
  #ready = false;

  constructor(storage: WorkbenchStorage, id: string, hooks: WorkbenchHooks) {
    this.#storage = storage;
    this.#id = id;
    this.#hooks = hooks;
  }

  get #sql(): SqlExec {
    return this.#storage.sql;
  }

  #rows(query: string, ...bindings: unknown[]): Row[] {
    return this.#sql.exec(query, ...bindings).toArray();
  }

  #first(query: string, ...bindings: unknown[]): Row | null {
    return this.#rows(query, ...bindings)[0] ?? null;
  }

  // Whether this store was ever written. A read of a store never written makes nothing, so a forged suffix or a
  // person with no workbench leaves no Durable Object behind.
  #started(): boolean {
    if (this.#ready) return true;
    this.#ready =
      this.#rows("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'wb_pairings'")
        .length > 0;
    return this.#ready;
  }

  // Makes the tables on the store's first write, noting whose store it is; its first sweep is a day later.
  #ensure(now: number, personId: string): void {
    if (!this.#started()) {
      for (const statement of SCHEMA.split(';')) if (statement.trim()) this.#sql.exec(statement);
      this.#sql.exec("INSERT OR IGNORE INTO wb_meta (key, value) VALUES ('swept_at', ?)", now);
      this.#ready = true;
    }
    if (this.#person === null) {
      this.#sql.exec("INSERT OR IGNORE INTO wb_meta (key, value) VALUES ('person', ?)", personId);
      this.#person = this.#personOf();
    }
    if (this.#person !== personId) throw new Error("workbench: a store is one person's");
  }

  #person: string | null = null;

  #personOf(): string | null {
    return (this.#first("SELECT value FROM wb_meta WHERE key = 'person'")?.value as string) ?? null;
  }

  // Whose store this is (null for one never written).
  #owner(): string {
    this.#person ??= this.#personOf();
    if (this.#person === null) throw new Error('workbench: a store with rows and no person');
    return this.#person;
  }

  #noteToken(token: WorkbenchToken, now: number): void {
    this.#sql.exec(
      `INSERT INTO wb_tokens (id, name, read_only, expires_at, revoked, seen_at) VALUES (?, ?, ?, ?, 0, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, read_only = excluded.read_only,
         expires_at = excluded.expires_at, revoked = 0, seen_at = excluded.seen_at`,
      token.id,
      token.name,
      token.readOnly ? 1 : 0,
      token.expiresAt,
      now,
    );
  }

  // When the alarm should next run: every five minutes while a session lives, else at the daily sweep, else
  // never (and the store is empty).
  async #schedule(now: number): Promise<void> {
    const live = this.#first('SELECT 1 FROM wb_sessions WHERE expires_at > ? LIMIT 1', now);
    const swept =
      (this.#first("SELECT value FROM wb_meta WHERE key = 'swept_at'")?.value as number) ?? now;
    const at = live ? now + WORKBENCH_TOKEN_CHECK_MS : swept + WORKBENCH_SWEEP_MS;
    const current = await this.#storage.getAlarm();
    if (current === null || current > at) await this.#storage.setAlarm(at);
  }

  // ----- Pairing requests -----

  // The one live request for a token, origin and scope: reused while it lives (taking a given name), replaced once
  // it has expired.
  async openPairingRequest(input: {
    personId: string;
    token: WorkbenchToken;
    origin: string;
    scope: S | 'workspace';
    name: string | null;
    now: number;
    ttlMs?: number;
  }): Promise<{ code: string; expiresAt: number; reused: boolean }> {
    const { token, origin, scope, name, now } = input;
    this.#ensure(now, input.personId);
    this.#noteToken(token, now);
    this.#sql.exec(
      `DELETE FROM wb_pairing_requests
        WHERE token_id = ? AND origin = ? AND scope = ? AND status = 'pending' AND expires_at <= ?`,
      token.id,
      origin,
      scope,
      now,
    );
    const live = this.#first(
      `SELECT code, name, expires_at FROM wb_pairing_requests
        WHERE token_id = ? AND origin = ? AND scope = ? AND status = 'pending'`,
      token.id,
      origin,
      scope,
    );
    if (live) {
      if (name !== null && name !== live.name)
        this.#sql.exec('UPDATE wb_pairing_requests SET name = ? WHERE code = ?', name, live.code);
      return { code: live.code as string, expiresAt: live.expires_at as number, reused: true };
    }
    const code = randomBase64Url(WORKBENCH_PAIRING_CODE_BYTES);
    const expiresAt = now + (input.ttlMs ?? WORKBENCH_PAIRING_TTL_MS);
    this.#sql.exec(
      `INSERT INTO wb_pairing_requests (code, token_id, origin, name, scope, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
      code,
      token.id,
      origin,
      name,
      scope,
      now,
      expiresAt,
    );
    await this.#schedule(now);
    return { code, expiresAt, reused: false };
  }

  async readPairingRequest(code: string, now: number): Promise<PairingRequestRead<S> | null> {
    if (!this.#started()) return null;
    const row = this.#first(
      `SELECT r.token_id, r.origin, r.name, r.scope, r.status, r.expires_at, t.name AS token_name
         FROM wb_pairing_requests r LEFT JOIN wb_tokens t ON t.id = r.token_id
        WHERE r.code = ?`,
      code,
    );
    if (!row) return null;
    return {
      tokenId: row.token_id as string,
      origin: row.origin as string,
      name: (row.name as string | null) ?? null,
      tokenName: (row.token_name as string | null) ?? null,
      scope: row.scope as S,
      expiresAt: row.expires_at as number,
      status: effectiveStatus(row.status as string, row.expires_at as number, now),
    };
  }

  // Answered once, by the person. A workspace approval on an origin already paired for the item scope widens that
  // pairing in place (same id, its name kept unless the request names one); an item approval never narrows a
  // workspace pairing.
  async answerPairingRequest(input: {
    code: string;
    answer: 'approve' | 'decline';
    now: number;
  }): Promise<PairingAnswer<S>> {
    const { code, answer, now } = input;
    const request = await this.readPairingRequest(code, now);
    if (!request) return { outcome: 'missing' };
    if (request.status === 'expired') return { outcome: 'expired' };
    if (request.status !== 'pending') return { outcome: 'answered' };
    this.#sql.exec(
      'UPDATE wb_pairing_requests SET status = ?, answered_at = ? WHERE code = ?',
      answer === 'approve' ? 'approved' : 'declined',
      now,
      code,
    );
    if (answer === 'decline')
      return { outcome: 'declined', tokenId: request.tokenId, asked: request.scope };
    this.#sql.exec(
      `INSERT INTO wb_pairings (id, token_id, origin, name, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (token_id, origin) DO UPDATE
         SET scope = 'workspace', name = COALESCE(excluded.name, wb_pairings.name)
         WHERE excluded.scope = 'workspace'`,
      crypto.randomUUID(),
      request.tokenId,
      request.origin,
      request.name,
      request.scope,
      now,
    );
    const pairing = await this.findPairing(request.tokenId, request.origin);
    if (!pairing) throw new Error('workbench: approved request recorded no pairing');
    return { outcome: 'approved', pairing, asked: request.scope };
  }

  // The waiting CLI's poll: only the token that asked may read its request.
  async pairingRequestStatus(
    code: string,
    tokenId: string,
    now: number,
  ): Promise<{ status: PairingStatus; expiresAt: number } | null> {
    if (!this.#started()) return null;
    const row = this.#first(
      'SELECT status, expires_at FROM wb_pairing_requests WHERE code = ? AND token_id = ?',
      code,
      tokenId,
    );
    if (!row) return null;
    const expiresAt = row.expires_at as number;
    return { status: effectiveStatus(row.status as string, expiresAt, now), expiresAt };
  }

  // ----- Pairings -----

  async findPairing(tokenId: string, origin: string): Promise<WorkbenchPairingRow<S> | null> {
    if (!this.#started()) return null;
    const row = this.#first(
      'SELECT id, token_id, origin, name, scope, created_at FROM wb_pairings WHERE token_id = ? AND origin = ?',
      tokenId,
      origin,
    );
    return row ? toPairing<S>(row) : null;
  }

  async hasPairing(id: string): Promise<boolean> {
    if (!this.#started()) return false;
    return this.#first('SELECT 1 FROM wb_pairings WHERE id = ?', id) !== null;
  }

  // The pairings of tokens still live, newest first (Settings). Asks liveworkspace about their tokens first (one
  // request), so a token revoked there drops off the list at once.
  async listPairings(now: number): Promise<WorkbenchPairingRow<S>[]> {
    if (!this.#started()) return [];
    const tokens = this.#rows(
      `SELECT DISTINCT p.token_id FROM wb_pairings p JOIN wb_tokens t ON t.id = p.token_id
        WHERE t.revoked = 0 AND t.expires_at > ?`,
      now,
    ).map((r) => r.token_id as string);
    await this.#endDeadTokens(tokens);
    return this.#rows(
      `SELECT p.id, p.token_id, p.origin, p.name, p.scope, p.created_at
         FROM wb_pairings p JOIN wb_tokens t ON t.id = p.token_id
        WHERE t.revoked = 0 AND t.expires_at > ?
        ORDER BY p.created_at DESC, p.id`,
      now,
    ).map((r) => toPairing<S>(r));
  }

  // ----- Tickets -----

  // A single-use ticket for a paired token. The plaintext comes back once, here.
  async mintTicket(input: {
    personId: string;
    token: WorkbenchToken;
    pairingId: string;
    reach: WorkbenchReach<S>;
    tabId: string | null;
    origin: string;
    role: Level;
    now: number;
    expiresAt: number;
  }): Promise<{ ticket: string; expiresAt: number }> {
    const { token, pairingId, reach, tabId, origin, role, now, expiresAt } = input;
    this.#ensure(now, input.personId);
    this.#noteToken(token, now);
    const ticket = `${randomBase64Url(WORKBENCH_TICKET_BYTES)}.${this.#id}`;
    this.#sql.exec(
      `INSERT INTO wb_tickets
         (ticket_hash, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      await sha256Hex(ticket),
      token.id,
      pairingId,
      reach.scope,
      reach.itemId,
      reach.folderId,
      tabId,
      origin,
      role,
      now,
      expiresAt,
    );
    await this.#schedule(now);
    return { ticket, expiresAt };
  }

  // Single use. A ticket whose token is no longer live reads as unknown.
  async consumeTicket(
    ticket: string,
    now: number,
  ): Promise<{ ok: true; ticket: ConsumedTicket<S> } | { ok: false; reason: InvalidTicketReason }> {
    const hash = await sha256Hex(ticket);
    if (!this.#started()) return { ok: false, reason: 'unknown' };
    const row = this.#first(
      `UPDATE wb_tickets SET used_at = ?
        WHERE ticket_hash = ? AND used_at IS NULL AND expires_at > ?
        RETURNING token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role`,
      now,
      hash,
      now,
    );
    if (!row) {
      const seen = this.#first('SELECT used_at FROM wb_tickets WHERE ticket_hash = ?', hash);
      if (!seen) return { ok: false, reason: 'unknown' };
      return { ok: false, reason: seen.used_at !== null ? 'used' : 'expired' };
    }
    const token = this.#first(
      'SELECT expires_at, read_only FROM wb_tokens WHERE id = ? AND revoked = 0 AND expires_at > ?',
      row.token_id,
      now,
    );
    if (!token) return { ok: false, reason: 'unknown' };
    return {
      ok: true,
      ticket: {
        ownerId: this.#owner(),
        tokenId: row.token_id as string,
        pairingId: row.pairing_id as string,
        ...reachOf<S>(row as ReachColumns),
        tabId: (row.tab_id as string | null) ?? null,
        origin: row.origin as string,
        role: row.role as Level,
        tokenExpiresAt: token.expires_at as number,
        tokenReadOnly: token.read_only === 1,
      },
    };
  }

  // ----- Sessions -----

  // A session from a consumed ticket. The secret comes back once, here.
  async openSession(input: {
    personId: string;
    tokenId: string;
    pairingId: string;
    reach: WorkbenchReach<S>;
    tabId: string | null;
    origin: string;
    role: Level;
    now: number;
    expiresAt: number;
  }): Promise<{ id: string; secret: string }> {
    const { tokenId, pairingId, reach, tabId, origin, role, now, expiresAt } = input;
    this.#ensure(now, input.personId);
    const id = crypto.randomUUID();
    const secret = `${WORKBENCH_SESSION_PREFIX}${randomBase64Url(WORKBENCH_SESSION_SECRET_BYTES)}.${this.#id}`;
    this.#sql.exec(
      `INSERT INTO wb_sessions
         (id, secret_hash, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role, created_at,
          expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      await sha256Hex(secret),
      tokenId,
      pairingId,
      reach.scope,
      reach.itemId,
      reach.folderId,
      tabId,
      origin,
      role,
      now,
      expiresAt,
    );
    await this.#schedule(now);
    return { id, secret };
  }

  // One indexed read per `lvw_` request, with the token's state so the caller can classify a refusal.
  async readSession(secret: string): Promise<WorkbenchSessionRead<S> | null> {
    const hash = await sha256Hex(secret);
    if (!this.#started()) return null;
    const row = this.#first(
      `SELECT s.id, s.token_id, s.pairing_id, s.scope, s.item_id, s.folder_id, s.tab_id, s.origin, s.role,
              s.created_at, s.expires_at,
              t.revoked AS token_revoked, t.read_only AS token_read_only, t.expires_at AS token_expires_at
         FROM wb_sessions s JOIN wb_tokens t ON t.id = s.token_id
        WHERE s.secret_hash = ?`,
      hash,
    );
    if (!row) return null;
    return {
      id: row.id as string,
      ownerId: this.#owner(),
      tokenId: row.token_id as string,
      pairingId: row.pairing_id as string,
      ...reachOf<S>(row as ReachColumns),
      tabId: (row.tab_id as string | null) ?? null,
      origin: row.origin as string,
      role: row.role as Level,
      createdAt: row.created_at as number,
      expiresAt: row.expires_at as number,
      tokenRevoked: row.token_revoked === 1,
      tokenReadOnly: row.token_read_only === 1,
      tokenExpiresAt: row.token_expires_at as number,
    };
  }

  async endSession(id: string): Promise<void> {
    if (!this.#started()) return;
    this.#sql.exec('DELETE FROM wb_sessions WHERE id = ?', id);
  }

  // A room a workspace session joined, so ending access can close it as it closes an item session's.
  async noteSessionRoom(sessionId: string, itemId: string): Promise<void> {
    if (!this.#started()) return;
    this.#sql.exec(
      `INSERT OR IGNORE INTO wb_session_rooms (session_id, item_id)
       SELECT id, ? FROM wb_sessions WHERE id = ?`,
      itemId,
      sessionId,
    );
  }

  // ----- Ending access -----

  // Removes the pairings (and with a token, its requests, marking it revoked), then closes the rooms their sessions
  // had open. The delete is the change; closing rooms is best effort, since every later request of a removed
  // session already fails.
  async endAccess(
    target: WorkbenchEndTarget,
    reason: WorkbenchEndReason,
  ): Promise<{ pairings: number; sessions: number; rooms: number; unreached: number }> {
    if (!this.#started()) return { pairings: 0, sessions: 0, rooms: 0, unreached: 0 };
    const byToken = 'tokenId' in target;
    const column = byToken ? 'token_id' : 'id';
    const key = byToken ? target.tokenId : target.pairingId;
    const pairings = this.#rows(
      `SELECT id, token_id, scope FROM wb_pairings WHERE ${column} = ?`,
      key,
    );
    const ofTarget = `SELECT id FROM wb_pairings WHERE ${column} = ?`;
    const sessions = this.#rows(
      `SELECT id, pairing_id, token_id, scope, item_id FROM wb_sessions WHERE pairing_id IN (${ofTarget})`,
      key,
    );
    const joined = this.#rows(
      `SELECT s.pairing_id, r.item_id FROM wb_session_rooms r JOIN wb_sessions s ON s.id = r.session_id
        WHERE s.pairing_id IN (${ofTarget})`,
      key,
    );
    this.#sql.exec(`DELETE FROM wb_pairings WHERE ${column} = ?`, key);
    if (byToken) {
      this.#sql.exec('DELETE FROM wb_pairing_requests WHERE token_id = ?', key);
      if (reason !== 'unpaired')
        this.#sql.exec('UPDATE wb_tokens SET revoked = 1 WHERE id = ?', key);
    }

    for (const session of sessions) {
      console.log('[workbench] session-ended', {
        reason,
        scope: session.scope,
        itemId: session.item_id,
        tokenId: session.token_id,
        sessionPrefix: sessionPrefixOf(session.id as string),
      });
    }
    let rooms = 0;
    let unreached = 0;
    for (const pairing of pairings) {
      const items = [
        ...new Set([
          ...sessions.flatMap((s) =>
            s.pairing_id === pairing.id && s.item_id !== null ? [s.item_id as string] : [],
          ),
          ...joined.filter((r) => r.pairing_id === pairing.id).map((r) => r.item_id as string),
        ]),
      ];
      let missed = 0;
      for (let i = 0; i < items.length; i += WORKBENCH_CLOSE_CONCURRENCY) {
        const reached = await Promise.all(
          items
            .slice(i, i + WORKBENCH_CLOSE_CONCURRENCY)
            .map((item) => this.#hooks.closeRoom(item, pairing.id as string).catch(() => false)),
        );
        missed += reached.filter((ok) => !ok).length;
      }
      rooms += items.length;
      unreached += missed;
      console.log('[workbench] unpaired', {
        tokenId: pairing.token_id,
        pairingId: pairing.id,
        scope: pairing.scope,
        reason,
        rooms: items.length,
        unreached: missed,
      });
    }
    return { pairings: pairings.length, sessions: sessions.length, rooms, unreached };
  }

  // The person's account closed: end every pairing (closing its rooms), then drop the store.
  async close(): Promise<void> {
    if (this.#started()) {
      for (const p of this.#rows('SELECT id FROM wb_pairings'))
        await this.endAccess({ pairingId: p.id as string }, 'closed');
    }
    await this.#storage.deleteAlarm();
    await this.#storage.deleteAll();
    this.#ready = false;
    this.#person = null;
  }

  // ----- Upkeep -----

  // Ends the access of whichever of these tokens liveworkspace says no longer work. A liveworkspace that can't
  // answer ends nothing; the next check asks again.
  async #endDeadTokens(ids: string[]): Promise<string[]> {
    const credentials = this.#hooks.credentials();
    if (!credentials || ids.length === 0) return [];
    const gone: string[] = [];
    try {
      for (let i = 0; i < ids.length; i += MAX_LIVE_TOKEN_IDS) {
        const batch = ids.slice(i, i + MAX_LIVE_TOKEN_IDS);
        const live = new Set(await liveTokenIds(credentials, batch, this.#hooks.fetcher));
        gone.push(...batch.filter((id) => !live.has(id)));
      }
    } catch (err) {
      console.warn('[workbench] token check failed', { error: String(err) });
      return [];
    }
    for (const tokenId of gone) await this.endAccess({ tokenId }, 'revoked');
    return gone;
  }

  // Spent tickets and requests, sessions past their grace, pairings of tokens no longer live, and tokens nothing
  // hangs off.
  #sweep(now: number): number {
    let deleted = 0;
    const run = (query: string, ...bindings: unknown[]) => {
      deleted += this.#rows(`${query} RETURNING 1`, ...bindings).length;
    };
    run('DELETE FROM wb_tickets WHERE expires_at <= ?', now);
    run('DELETE FROM wb_pairing_requests WHERE expires_at <= ?', now);
    run('DELETE FROM wb_sessions WHERE expires_at <= ?', now - WORKBENCH_SESSION_GRACE_MS);
    run(
      `DELETE FROM wb_pairings WHERE token_id IN
         (SELECT id FROM wb_tokens WHERE revoked = 1 OR expires_at <= ?)`,
      now,
    );
    run(
      `DELETE FROM wb_tokens WHERE id NOT IN (SELECT token_id FROM wb_pairings)
         AND id NOT IN (SELECT token_id FROM wb_pairing_requests)
         AND id NOT IN (SELECT token_id FROM wb_sessions)`,
    );
    return deleted;
  }

  // The alarm: every five minutes while a session lives, the tokens behind live sessions are checked; daily, every
  // paired token is, and spent rows go. A store left with nothing deletes itself.
  async alarm(now = Date.now()): Promise<{ revoked: string[]; swept: number }> {
    if (!this.#started()) return { revoked: [], swept: 0 };
    const sweptAt =
      (this.#first("SELECT value FROM wb_meta WHERE key = 'swept_at'")?.value as number) ?? 0;
    const daily = now - sweptAt >= WORKBENCH_SWEEP_MS;
    const tokens = this.#rows(
      daily
        ? `SELECT id FROM wb_tokens WHERE revoked = 0 AND expires_at > ?
             AND (id IN (SELECT token_id FROM wb_pairings) OR id IN (SELECT token_id FROM wb_sessions WHERE expires_at > ?))`
        : `SELECT DISTINCT token_id AS id FROM wb_sessions s JOIN wb_tokens t ON t.id = s.token_id
            WHERE s.expires_at > ? AND t.revoked = 0 AND t.expires_at > ?`,
      now,
      now,
    ).map((r) => r.id as string);
    const revoked = await this.#endDeadTokens(tokens);
    let swept = 0;
    if (daily) {
      swept = this.#sweep(now);
      this.#sql.exec(
        "INSERT INTO wb_meta (key, value) VALUES ('swept_at', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
        now,
      );
      const left = this.#first(
        `SELECT 1 FROM wb_tokens UNION ALL SELECT 1 FROM wb_pairings UNION ALL SELECT 1 FROM wb_pairing_requests
         UNION ALL SELECT 1 FROM wb_tickets UNION ALL SELECT 1 FROM wb_sessions LIMIT 1`,
      );
      if (!left) {
        await this.#storage.deleteAll();
        this.#ready = false;
        this.#person = null;
        return { revoked, swept };
      }
    }
    await this.#storage.deleteAlarm();
    await this.#schedule(now);
    return { revoked, swept };
  }
}

// The store's methods as the app calls them, on the Durable Object's stub.
export type WorkbenchStoreApi<S extends string = string> = Pick<
  WorkbenchCore<S>,
  | 'openPairingRequest'
  | 'readPairingRequest'
  | 'answerPairingRequest'
  | 'pairingRequestStatus'
  | 'findPairing'
  | 'hasPairing'
  | 'listPairings'
  | 'mintTicket'
  | 'consumeTicket'
  | 'openSession'
  | 'readSession'
  | 'endSession'
  | 'noteSessionRoom'
  | 'endAccess'
  | 'close'
>;

// The Durable Object class, built on the runtime's `DurableObject` (passed in, so this module never imports
// `cloudflare:workers` and node tests can load it). In the app:
//
//   import { DurableObject } from 'cloudflare:workers';
//   export class WorkbenchStore extends workbenchStoreClass<Env, 'project'>(DurableObject, (env) => ({
//     credentials: () => accountCredentials(env),
//     closeRoom: (itemId, pairingId) => closeWorkbenchSessions(env, itemId, pairingId),
//   })) {}
//
// and bind it as WORKBENCH (wrangler: a durable_objects binding and a `new_sqlite_classes` migration).
type DurableObjectBase<E> = abstract new (ctx: DurableObjectState, env: E) => object;

export function workbenchStoreClass<E, S extends string = string>(
  Base: DurableObjectBase<E>,
  hooksOf: (env: E) => WorkbenchHooks,
) {
  abstract class WorkbenchStoreBase extends Base implements WorkbenchStoreApi<S> {
    readonly core: WorkbenchCore<S>;
    constructor(ctx: DurableObjectState, env: E) {
      super(ctx, env);
      this.core = new WorkbenchCore<S>(ctx.storage, ctx.id.toString(), hooksOf(env));
    }
    openPairingRequest(...a: Parameters<WorkbenchCore<S>['openPairingRequest']>) {
      return this.core.openPairingRequest(...a);
    }
    readPairingRequest(...a: Parameters<WorkbenchCore<S>['readPairingRequest']>) {
      return this.core.readPairingRequest(...a);
    }
    answerPairingRequest(...a: Parameters<WorkbenchCore<S>['answerPairingRequest']>) {
      return this.core.answerPairingRequest(...a);
    }
    pairingRequestStatus(...a: Parameters<WorkbenchCore<S>['pairingRequestStatus']>) {
      return this.core.pairingRequestStatus(...a);
    }
    findPairing(...a: Parameters<WorkbenchCore<S>['findPairing']>) {
      return this.core.findPairing(...a);
    }
    hasPairing(...a: Parameters<WorkbenchCore<S>['hasPairing']>) {
      return this.core.hasPairing(...a);
    }
    listPairings(...a: Parameters<WorkbenchCore<S>['listPairings']>) {
      return this.core.listPairings(...a);
    }
    mintTicket(...a: Parameters<WorkbenchCore<S>['mintTicket']>) {
      return this.core.mintTicket(...a);
    }
    consumeTicket(...a: Parameters<WorkbenchCore<S>['consumeTicket']>) {
      return this.core.consumeTicket(...a);
    }
    openSession(...a: Parameters<WorkbenchCore<S>['openSession']>) {
      return this.core.openSession(...a);
    }
    readSession(...a: Parameters<WorkbenchCore<S>['readSession']>) {
      return this.core.readSession(...a);
    }
    endSession(...a: Parameters<WorkbenchCore<S>['endSession']>) {
      return this.core.endSession(...a);
    }
    noteSessionRoom(...a: Parameters<WorkbenchCore<S>['noteSessionRoom']>) {
      return this.core.noteSessionRoom(...a);
    }
    endAccess(...a: Parameters<WorkbenchCore<S>['endAccess']>) {
      return this.core.endAccess(...a);
    }
    close() {
      return this.core.close();
    }
    async alarm(): Promise<void> {
      await this.core.alarm();
    }
  }
  return WorkbenchStoreBase;
}

// The namespace the app binds the class to, as these helpers need it.
export type WorkbenchNamespace = {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): unknown;
};

// The person's store.
export function workbenchStoreOf<S extends string = string>(
  ns: WorkbenchNamespace,
  personId: string,
): WorkbenchStoreApi<S> {
  return ns.get(ns.idFromName(personId)) as WorkbenchStoreApi<S>;
}

// The store a ticket or session secret names, or null for a secret with no (or a malformed) suffix.
export function workbenchStoreOfSecret<S extends string = string>(
  ns: WorkbenchNamespace,
  secret: string,
): WorkbenchStoreApi<S> | null {
  const id = storeIdOfSecret(secret);
  if (!id) return null;
  try {
    return ns.get(ns.idFromString(id)) as WorkbenchStoreApi<S>;
  } catch {
    return null;
  }
}
