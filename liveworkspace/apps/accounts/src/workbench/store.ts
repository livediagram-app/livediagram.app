// One person's workbench (liveworkspace/docs/workbench.md "The store"): their pairing requests, pairings, tickets,
// sessions, the rooms a workspace session joined, and their notification email allowance, in one Durable Object's
// SQLite. Every app's workbench lives here; a row names its app.
//
// A route that knows the person reaches the store by their id. Redeeming a ticket and presenting a session have no one
// signed in, so those secrets carry the store's id after a dot (`<random>.<64 hex>`). The suffix is no credential:
// the store holds only each secret's SHA-256, so a forged suffix reaches a store that knows nothing of it.
//
// The store keeps no copy of tokens: a token's state is accounts' own `api_token` row, which the routes read where it
// matters. The store does no network: ending access answers the rooms to close, and the caller closes them.
//
// Idle at no cost: the alarm is set only while a ticket, a pairing request, a session or an allowance use will lapse,
// for the earliest such moment, and cleared once nothing will. A store left with nothing deletes itself.

// ---------- Constants -----------------------------------------------------------------------------------------

export const WORKBENCH_SESSION_PREFIX = 'lvw_';
// Random bytes in a ticket, a pairing code and a session secret, before the routing suffix.
export const WORKBENCH_TICKET_BYTES = 16;
export const WORKBENCH_PAIRING_CODE_BYTES = 16;
export const WORKBENCH_SESSION_SECRET_BYTES = 32;
// A pairing request waits this long for its answer.
export const WORKBENCH_PAIRING_TTL_MS = 10 * 60 * 1000;
// A session past its expiry is kept this long, so its refusal reads "expired" rather than "unknown".
export const WORKBENCH_SESSION_GRACE_MS = 24 * 60 * 60 * 1000;
// The most uses one allowance counts: a cap above it is refused as a mistake.
export const WORKBENCH_QUOTA_MAX = 1_000;
// The most rooms one session notes: more is a runaway frame, and one close call to the index carries this many.
export const WORKBENCH_SESSION_ROOMS_MAX = 500;

// A store's id as `DurableObjectId.toString()` gives it, after the secret's dot.
const ROUTE_SUFFIX = /\.([0-9a-f]{64})$/;
// A ticket: 16 random bytes as base64url, then the store's id.
export const WORKBENCH_TICKET_PATTERN = /^[A-Za-z0-9_-]{22}\.[0-9a-f]{64}$/;
// A session: `lvw_`, 32 random bytes as base64url, then the store's id.
export const WORKBENCH_SESSION_PATTERN = /^lvw_[A-Za-z0-9_-]{43}\.[0-9a-f]{64}$/;
// A pairing code: 16 random bytes as base64url.
export const WORKBENCH_CODE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

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

export type WorkbenchLevel = 'view' | 'participate' | 'edit';
export type WorkbenchScope = 'item' | 'workspace';

// What a ticket or session reaches: one item, or the workspace from an optional folder.
export type WorkbenchReach =
  | { scope: 'item'; itemId: string; folderId: null }
  | { scope: 'workspace'; itemId: null; folderId: string | null };

export type WorkbenchPairingRow = {
  id: string;
  app: string;
  tokenId: string;
  origin: string;
  name: string | null;
  scope: WorkbenchScope;
  pairedAt: number;
};

export type PairingStatus = 'pending' | 'approved' | 'declined' | 'expired';

export type PairingRequestRead = {
  app: string;
  tokenId: string;
  origin: string;
  name: string | null;
  scope: WorkbenchScope;
  expiresAt: number;
  status: PairingStatus;
};

export type PairingAnswer =
  | { outcome: 'approved'; pairing: WorkbenchPairingRow; asked: WorkbenchScope }
  | { outcome: 'declined'; tokenId: string; asked: WorkbenchScope }
  | { outcome: 'missing' }
  | { outcome: 'answered' }
  | { outcome: 'expired' };

export type InvalidTicketReason = 'unknown' | 'used' | 'expired';

export type ConsumedTicket = {
  ownerId: string;
  app: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchLevel;
} & WorkbenchReach;

export type WorkbenchSessionRead = {
  id: string;
  ownerId: string;
  app: string;
  tokenId: string;
  pairingId: string;
  tabId: string | null;
  origin: string;
  role: WorkbenchLevel;
  createdAt: number;
  expiresAt: number;
} & WorkbenchReach;

export type WorkbenchEndTarget = { pairingId: string } | { tokenId: string };
export type WorkbenchEndReason = 'unpaired' | 'revoked' | 'closed';

// A pairing's rooms to close once its rows are gone: each item a session of it had open.
export type RoomsToClose = { app: string; pairingId: string; itemIds: string[] };

export type EndedAccess = { pairings: number; sessions: number; rooms: RoomsToClose[] };

// The slice of a Durable Object's storage the store uses.
export type SqlExec = {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] };
};
export type WorkbenchStorage = {
  sql: SqlExec;
  getAlarm(): Promise<number | null>;
  setAlarm(at: number): Promise<void>;
  deleteAlarm(): Promise<void>;
  deleteAll(): Promise<void>;
};

// ---------- Schema ---------------------------------------------------------------------------------------------

const SCHEMA = `
CREATE TABLE IF NOT EXISTS wb_pairing_requests (
  code        TEXT    PRIMARY KEY,
  app         TEXT    NOT NULL,
  token_id    TEXT    NOT NULL,
  origin      TEXT    NOT NULL,
  name        TEXT,
  scope       TEXT    NOT NULL CHECK (scope IN ('item', 'workspace')),
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  answered_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS wb_pairing_requests_live
  ON wb_pairing_requests (app, token_id, origin, scope) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS wb_pairing_requests_expiry ON wb_pairing_requests (expires_at);
CREATE TABLE IF NOT EXISTS wb_pairings (
  id         TEXT    PRIMARY KEY,
  app        TEXT    NOT NULL,
  token_id   TEXT    NOT NULL,
  origin     TEXT    NOT NULL,
  name       TEXT,
  scope      TEXT    NOT NULL CHECK (scope IN ('item', 'workspace')),
  created_at INTEGER NOT NULL,
  UNIQUE (app, token_id, origin)
);
CREATE INDEX IF NOT EXISTS wb_pairings_token ON wb_pairings (token_id);
CREATE TABLE IF NOT EXISTS wb_tickets (
  ticket_hash TEXT    PRIMARY KEY,
  app         TEXT    NOT NULL,
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
CREATE INDEX IF NOT EXISTS wb_tickets_expiry ON wb_tickets (expires_at);
CREATE INDEX IF NOT EXISTS wb_tickets_pairing ON wb_tickets (pairing_id);
CREATE TABLE IF NOT EXISTS wb_sessions (
  id          TEXT    PRIMARY KEY,
  secret_hash TEXT    NOT NULL UNIQUE,
  app         TEXT    NOT NULL,
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
CREATE INDEX IF NOT EXISTS wb_sessions_expiry ON wb_sessions (expires_at);
CREATE TABLE IF NOT EXISTS wb_session_rooms (
  session_id TEXT NOT NULL REFERENCES wb_sessions (id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL,
  PRIMARY KEY (session_id, item_id)
);
CREATE TABLE IF NOT EXISTS wb_quota (
  kind  TEXT    NOT NULL,
  at    INTEGER NOT NULL,
  until INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS wb_quota_kind ON wb_quota (kind, at);
CREATE INDEX IF NOT EXISTS wb_quota_until ON wb_quota (until);
CREATE TABLE IF NOT EXISTS wb_meta (
  key   TEXT PRIMARY KEY,
  value      NOT NULL
)`;

type Row = Record<string, unknown>;

type ReachColumns = { scope: string; item_id: string | null; folder_id: string | null };

function reachOf(row: ReachColumns): WorkbenchReach {
  if (row.scope === 'workspace')
    return { scope: 'workspace', itemId: null, folderId: row.folder_id };
  if (row.item_id === null) throw new Error('workbench: an item row with no item');
  return { scope: 'item', itemId: row.item_id, folderId: null };
}

const toPairing = (row: Row): WorkbenchPairingRow => ({
  id: row.id as string,
  app: row.app as string,
  tokenId: row.token_id as string,
  origin: row.origin as string,
  name: (row.name as string | null) ?? null,
  scope: row.scope as WorkbenchScope,
  pairedAt: row.created_at as number,
});

const PAIRING_COLUMNS = 'id, app, token_id, origin, name, scope, created_at';

const effectiveStatus = (status: string, expiresAt: number, now: number): PairingStatus =>
  status === 'pending' && expiresAt <= now ? 'expired' : (status as PairingStatus);

// A workspace pairing also covers the item scope; an item pairing never covers the workspace.
export const pairingCovers = (pairing: WorkbenchScope, asked: WorkbenchScope) =>
  pairing === 'workspace' || asked === 'item';

// ---------- The store ------------------------------------------------------------------------------------------

// One person's workbench. Every method is async, as it is over the Durable Object's RPC.
export class WorkbenchCore {
  readonly #storage: WorkbenchStorage;
  // The store's own id, the suffix of every secret it issues.
  readonly #id: string;
  #ready = false;
  #person: string | null = null;

  constructor(storage: WorkbenchStorage, id: string) {
    this.#storage = storage;
    this.#id = id;
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

  // Makes the tables on the store's first write, noting whose store it is.
  #ensure(personId: string): void {
    if (!this.#started()) {
      for (const statement of SCHEMA.split(';')) if (statement.trim()) this.#sql.exec(statement);
      this.#ready = true;
    }
    if (this.#person === null) {
      this.#sql.exec("INSERT OR IGNORE INTO wb_meta (key, value) VALUES ('person', ?)", personId);
      this.#person = this.#personOf();
    }
    if (this.#person !== personId) throw new Error("workbench: a store is one person's");
  }

  #personOf(): string | null {
    return (this.#first("SELECT value FROM wb_meta WHERE key = 'person'")?.value as string) ?? null;
  }

  // Whose store this is.
  #owner(): string {
    this.#person ??= this.#personOf();
    if (this.#person === null) throw new Error('workbench: a store with rows and no person');
    return this.#person;
  }

  // The next moment something here lapses (a ticket, a request, a session past its grace, an allowance use), or null
  // when nothing will. Pairings never lapse on their own.
  #nextLapse(): number | null {
    const row = this.#first(
      `SELECT MIN(at) AS at FROM (
         SELECT MIN(expires_at) AS at FROM wb_tickets
         UNION ALL SELECT MIN(expires_at) FROM wb_pairing_requests
         UNION ALL SELECT MIN(expires_at) + ? FROM wb_sessions
         UNION ALL SELECT MIN(until) FROM wb_quota)`,
      WORKBENCH_SESSION_GRACE_MS,
    );
    return typeof row?.at === 'number' ? row.at : null;
  }

  // Sets the alarm for the next lapse, or clears it when nothing will lapse.
  async #schedule(): Promise<void> {
    const at = this.#nextLapse();
    const current = await this.#storage.getAlarm();
    if (at === null) {
      if (current !== null) await this.#storage.deleteAlarm();
      return;
    }
    if (current === null || current > at) await this.#storage.setAlarm(at);
  }

  // ----- Pairing requests -----

  // The one live request for an app, token, origin and scope: reused while it lives (taking a given name), replaced
  // once it has expired.
  async openPairingRequest(input: {
    personId: string;
    app: string;
    tokenId: string;
    origin: string;
    scope: WorkbenchScope;
    name: string | null;
    now: number;
    ttlMs?: number;
  }): Promise<{ code: string; expiresAt: number; reused: boolean }> {
    const { app, tokenId, origin, scope, name, now } = input;
    this.#ensure(input.personId);
    this.#sql.exec(
      `DELETE FROM wb_pairing_requests
        WHERE app = ? AND token_id = ? AND origin = ? AND scope = ? AND status = 'pending' AND expires_at <= ?`,
      app,
      tokenId,
      origin,
      scope,
      now,
    );
    const live = this.#first(
      `SELECT code, name, expires_at FROM wb_pairing_requests
        WHERE app = ? AND token_id = ? AND origin = ? AND scope = ? AND status = 'pending'`,
      app,
      tokenId,
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
    await this.#schedule();
    return { code, expiresAt, reused: false };
  }

  async readPairingRequest(code: string, now: number): Promise<PairingRequestRead | null> {
    if (!this.#started()) return null;
    const row = this.#first(
      `SELECT app, token_id, origin, name, scope, status, expires_at FROM wb_pairing_requests WHERE code = ?`,
      code,
    );
    if (!row) return null;
    return {
      app: row.app as string,
      tokenId: row.token_id as string,
      origin: row.origin as string,
      name: (row.name as string | null) ?? null,
      scope: row.scope as WorkbenchScope,
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
  }): Promise<PairingAnswer> {
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
    const pairing = await this.findPairing(request.app, request.tokenId, request.origin);
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

  async findPairing(
    app: string,
    tokenId: string,
    origin: string,
  ): Promise<WorkbenchPairingRow | null> {
    if (!this.#started()) return null;
    const row = this.#first(
      `SELECT ${PAIRING_COLUMNS} FROM wb_pairings WHERE app = ? AND token_id = ? AND origin = ?`,
      app,
      tokenId,
      origin,
    );
    return row ? toPairing(row) : null;
  }

  async readPairing(id: string): Promise<WorkbenchPairingRow | null> {
    if (!this.#started()) return null;
    const row = this.#first(`SELECT ${PAIRING_COLUMNS} FROM wb_pairings WHERE id = ?`, id);
    return row ? toPairing(row) : null;
  }

  // Every pairing (of one app, or all), newest first. The caller drops those of tokens no longer live.
  async listPairings(app: string | null): Promise<WorkbenchPairingRow[]> {
    if (!this.#started()) return [];
    return this.#rows(
      `SELECT ${PAIRING_COLUMNS} FROM wb_pairings WHERE ? IS NULL OR app = ?
        ORDER BY created_at DESC, id`,
      app,
      app,
    ).map(toPairing);
  }

  // ----- Tickets -----

  // A single-use ticket for a pairing. The plaintext comes back once, here.
  async mintTicket(input: {
    personId: string;
    pairingId: string;
    reach: WorkbenchReach;
    tabId: string | null;
    role: WorkbenchLevel;
    now: number;
    expiresAt: number;
  }): Promise<{ ticket: string; expiresAt: number } | null> {
    const { pairingId, reach, tabId, role, now, expiresAt } = input;
    this.#ensure(input.personId);
    const pairing = await this.readPairing(pairingId);
    if (!pairing) return null;
    const ticket = `${randomBase64Url(WORKBENCH_TICKET_BYTES)}.${this.#id}`;
    this.#sql.exec(
      `INSERT INTO wb_tickets
         (ticket_hash, app, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role, created_at,
          expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      await sha256Hex(ticket),
      pairing.app,
      pairing.tokenId,
      pairingId,
      reach.scope,
      reach.itemId,
      reach.folderId,
      tabId,
      pairing.origin,
      role,
      now,
      expiresAt,
    );
    await this.#schedule();
    return { ticket, expiresAt };
  }

  // Single use, and only on the app it was minted for: a ticket another app's address presents is unknown there
  // and stays unspent.
  async consumeTicket(
    ticket: string,
    app: string,
    now: number,
  ): Promise<{ ok: true; ticket: ConsumedTicket } | { ok: false; reason: InvalidTicketReason }> {
    const hash = await sha256Hex(ticket);
    if (!this.#started()) return { ok: false, reason: 'unknown' };
    const row = this.#first(
      `UPDATE wb_tickets SET used_at = ?
        WHERE ticket_hash = ? AND app = ? AND used_at IS NULL AND expires_at > ?
        RETURNING app, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role`,
      now,
      hash,
      app,
      now,
    );
    if (!row) {
      const seen = this.#first(
        'SELECT used_at FROM wb_tickets WHERE ticket_hash = ? AND app = ?',
        hash,
        app,
      );
      if (!seen) return { ok: false, reason: 'unknown' };
      return { ok: false, reason: seen.used_at !== null ? 'used' : 'expired' };
    }
    return {
      ok: true,
      ticket: {
        ownerId: this.#owner(),
        app: row.app as string,
        tokenId: row.token_id as string,
        pairingId: row.pairing_id as string,
        ...reachOf(row as ReachColumns),
        tabId: (row.tab_id as string | null) ?? null,
        origin: row.origin as string,
        role: row.role as WorkbenchLevel,
      },
    };
  }

  // ----- Sessions -----

  // A session from a consumed ticket, while its pairing stands. The secret comes back once, here.
  async openSession(input: {
    personId: string;
    pairingId: string;
    reach: WorkbenchReach;
    tabId: string | null;
    role: WorkbenchLevel;
    now: number;
    expiresAt: number;
  }): Promise<{ id: string; secret: string } | null> {
    const { pairingId, reach, tabId, role, now, expiresAt } = input;
    this.#ensure(input.personId);
    const pairing = await this.readPairing(pairingId);
    if (!pairing) return null;
    const id = crypto.randomUUID();
    const secret = `${WORKBENCH_SESSION_PREFIX}${randomBase64Url(WORKBENCH_SESSION_SECRET_BYTES)}.${this.#id}`;
    this.#sql.exec(
      `INSERT INTO wb_sessions
         (id, secret_hash, app, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role, created_at,
          expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      await sha256Hex(secret),
      pairing.app,
      pairing.tokenId,
      pairingId,
      reach.scope,
      reach.itemId,
      reach.folderId,
      tabId,
      pairing.origin,
      role,
      now,
      expiresAt,
    );
    await this.#schedule();
    return { id, secret };
  }

  // One indexed read per check.
  async readSession(secret: string): Promise<WorkbenchSessionRead | null> {
    const hash = await sha256Hex(secret);
    if (!this.#started()) return null;
    const row = this.#first(
      `SELECT id, app, token_id, pairing_id, scope, item_id, folder_id, tab_id, origin, role, created_at, expires_at
         FROM wb_sessions WHERE secret_hash = ?`,
      hash,
    );
    if (!row) return null;
    return {
      id: row.id as string,
      ownerId: this.#owner(),
      app: row.app as string,
      tokenId: row.token_id as string,
      pairingId: row.pairing_id as string,
      ...reachOf(row as ReachColumns),
      tabId: (row.tab_id as string | null) ?? null,
      origin: row.origin as string,
      role: row.role as WorkbenchLevel,
      createdAt: row.created_at as number,
      expiresAt: row.expires_at as number,
    };
  }

  async endSession(id: string): Promise<void> {
    if (!this.#started()) return;
    this.#sql.exec('DELETE FROM wb_sessions WHERE id = ?', id);
    await this.#schedule();
  }

  // A room a live workspace session of this app joined, so ending access can close it as it closes an item session's.
  // Answers whether the session is one (a note for another app's session, or a gone one, is dropped).
  async noteSessionRoom(sessionId: string, app: string, itemId: string): Promise<boolean> {
    if (!this.#started()) return false;
    const session = this.#first(
      'SELECT 1 FROM wb_sessions WHERE id = ? AND app = ? AND scope = ?',
      sessionId,
      app,
      'workspace',
    );
    if (!session) return false;
    this.#sql.exec(
      `INSERT OR IGNORE INTO wb_session_rooms (session_id, item_id)
       SELECT ?, ? WHERE (SELECT COUNT(*) FROM wb_session_rooms WHERE session_id = ?) < ?`,
      sessionId,
      itemId,
      sessionId,
      WORKBENCH_SESSION_ROOMS_MAX,
    );
    return true;
  }

  // ----- Ending access -----

  // Removes the pairings (and with a token, its requests), then answers the rooms their sessions had open, for the
  // caller to close. The delete is the change: every later check of a removed session already fails.
  async endAccess(target: WorkbenchEndTarget, reason: WorkbenchEndReason): Promise<EndedAccess> {
    if (!this.#started()) return { pairings: 0, sessions: 0, rooms: [] };
    const byToken = 'tokenId' in target;
    const column = byToken ? 'token_id' : 'id';
    const key = byToken ? target.tokenId : target.pairingId;
    const pairings = this.#rows(
      `SELECT id, app, token_id, scope FROM wb_pairings WHERE ${column} = ?`,
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
    if (byToken) this.#sql.exec('DELETE FROM wb_pairing_requests WHERE token_id = ?', key);

    for (const session of sessions) {
      console.log('[workbench] session-ended', {
        reason,
        scope: session.scope,
        itemId: session.item_id,
        tokenId: session.token_id,
        sessionPrefix: sessionPrefixOf(session.id as string),
      });
    }
    const rooms: RoomsToClose[] = [];
    for (const pairing of pairings) {
      const itemIds = [
        ...new Set([
          ...sessions.flatMap((s) =>
            s.pairing_id === pairing.id && s.item_id !== null ? [s.item_id as string] : [],
          ),
          ...joined.filter((r) => r.pairing_id === pairing.id).map((r) => r.item_id as string),
        ]),
      ];
      if (itemIds.length > 0) {
        rooms.push({ app: pairing.app as string, pairingId: pairing.id as string, itemIds });
      }
      console.log('[workbench] unpaired', {
        app: pairing.app,
        tokenId: pairing.token_id,
        pairingId: pairing.id,
        scope: pairing.scope,
        reason,
        rooms: itemIds.length,
      });
    }
    await this.#settle();
    return { pairings: pairings.length, sessions: sessions.length, rooms };
  }

  // The person's account closed: end every pairing, answer their rooms, and drop the store.
  async close(): Promise<RoomsToClose[]> {
    const rooms: RoomsToClose[] = [];
    if (this.#started()) {
      for (const p of this.#rows('SELECT id FROM wb_pairings'))
        rooms.push(...(await this.endAccess({ pairingId: p.id as string }, 'closed')).rooms);
    }
    await this.#drop();
    return rooms;
  }

  // ----- Allowances -----

  // A cap on something the person does across every item, such as the notification emails they cause: at most `max`
  // uses of `kind` in any `windowMs`. Takes up to `count` uses at once (one call for a whole save's emails) and
  // answers how many it took; none are written past the cap.
  async takeQuota(input: {
    personId: string;
    kind: string;
    max: number;
    windowMs: number;
    now: number;
    count?: number;
  }): Promise<number> {
    const { personId, kind, max, windowMs, now, count = 1 } = input;
    if (!Number.isInteger(max) || max < 1 || max > WORKBENCH_QUOTA_MAX || !(windowMs > 0)) {
      throw new Error('workbench: an allowance needs a cap of 1 to 1,000 and a window');
    }
    if (!Number.isInteger(count) || count < 1) throw new Error('workbench: take at least one use');
    this.#ensure(personId);
    this.#sql.exec('DELETE FROM wb_quota WHERE kind = ? AND at <= ?', kind, now - windowMs);
    const used = Number(
      this.#first('SELECT COUNT(*) AS n FROM wb_quota WHERE kind = ?', kind)?.n ?? 0,
    );
    const taken = Math.max(0, Math.min(count, max - used));
    if (taken === 0) return 0;
    this.#sql.exec(
      `INSERT INTO wb_quota (kind, at, until)
       WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ?)
       SELECT ?, ?, ? FROM n`,
      taken,
      kind,
      now,
      now + windowMs,
    );
    await this.#schedule();
    return taken;
  }

  // ----- Upkeep -----

  #hasRows(): boolean {
    return (
      this.#first(
        `SELECT 1 FROM wb_pairings UNION ALL SELECT 1 FROM wb_pairing_requests UNION ALL SELECT 1 FROM wb_tickets
         UNION ALL SELECT 1 FROM wb_sessions UNION ALL SELECT 1 FROM wb_quota LIMIT 1`,
      ) !== null
    );
  }

  async #drop(): Promise<void> {
    await this.#storage.deleteAlarm();
    await this.#storage.deleteAll();
    this.#ready = false;
    this.#person = null;
  }

  // After rows went: a store left with nothing deletes itself, any other sets its alarm for what is left to lapse.
  async #settle(): Promise<void> {
    if (!this.#hasRows()) await this.#drop();
    else await this.#schedule();
  }

  // What has lapsed: tickets and requests past their expiry, sessions past their grace, allowance uses past their
  // window. Answers how many rows went.
  #sweep(now: number): number {
    let deleted = 0;
    const run = (query: string, ...bindings: unknown[]) => {
      deleted += this.#rows(`${query} RETURNING 1`, ...bindings).length;
    };
    run('DELETE FROM wb_tickets WHERE expires_at <= ?', now);
    run('DELETE FROM wb_pairing_requests WHERE expires_at <= ?', now);
    run('DELETE FROM wb_sessions WHERE expires_at <= ?', now - WORKBENCH_SESSION_GRACE_MS);
    run('DELETE FROM wb_quota WHERE until <= ?', now);
    return deleted;
  }

  // The alarm: what has lapsed goes, then the alarm is set for the next lapse, or cleared.
  async alarm(now = Date.now()): Promise<{ swept: number }> {
    // This alarm has fired: whatever is set next is for what is left.
    await this.#storage.deleteAlarm();
    if (!this.#started()) return { swept: 0 };
    const swept = this.#sweep(now);
    await this.#settle();
    return { swept };
  }
}

// The store's methods as the routes call them, on the Durable Object's stub.
export type WorkbenchStoreApi = Pick<
  WorkbenchCore,
  | 'openPairingRequest'
  | 'readPairingRequest'
  | 'answerPairingRequest'
  | 'pairingRequestStatus'
  | 'findPairing'
  | 'readPairing'
  | 'listPairings'
  | 'mintTicket'
  | 'consumeTicket'
  | 'openSession'
  | 'readSession'
  | 'endSession'
  | 'noteSessionRoom'
  | 'endAccess'
  | 'takeQuota'
  | 'close'
>;

// The namespace the Worker binds the class to, as these helpers need it.
export type WorkbenchNamespace = {
  idFromName(name: string): DurableObjectId;
  idFromString(id: string): DurableObjectId;
  get(id: DurableObjectId): unknown;
};

// The person's store.
export function workbenchStoreOf(ns: WorkbenchNamespace, personId: string): WorkbenchStoreApi {
  return ns.get(ns.idFromName(personId)) as WorkbenchStoreApi;
}

// The store a ticket or session secret names, or null for a secret with no (or a malformed) suffix.
export function workbenchStoreOfSecret(
  ns: WorkbenchNamespace,
  secret: string,
): WorkbenchStoreApi | null {
  const id = storeIdOfSecret(secret);
  if (!id) return null;
  try {
    return ns.get(ns.idFromString(id)) as WorkbenchStoreApi;
  } catch {
    return null;
  }
}
