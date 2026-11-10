// One person's workbench (liveworkspace/docs/specs/011-workbench/workbench.md "The store"): their pairing requests, pairings, tickets,
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

import {
  type ConsumedTicket,
  type EndedAccess,
  type InvalidTicketReason,
  type PairingAnswer,
  type PairingRequestRead,
  type PairingStatus,
  randomBase64Url,
  type RoomsToClose,
  sha256Hex,
  type SqlExec,
  WORKBENCH_PAIRING_CODE_BYTES,
  WORKBENCH_PAIRING_TTL_MS,
  WORKBENCH_SESSION_PREFIX,
  WORKBENCH_SESSION_ROOMS_MAX,
  WORKBENCH_SESSION_SECRET_BYTES,
  WORKBENCH_TICKET_BYTES,
  type WorkbenchEndReason,
  type WorkbenchEndTarget,
  type WorkbenchLevel,
  type WorkbenchPairingRow,
  type WorkbenchReach,
  type WorkbenchScope,
  type WorkbenchSessionRead,
  type WorkbenchStorage,
} from './store-types.ts';
import {
  effectiveStatus,
  PAIRING_COLUMNS,
  type Row,
  SCHEMA,
  toConsumedTicket,
  toPairing,
  toPairingRequest,
  toSessionRead,
} from './store-schema.ts';
import { roomsOfEndedAccess } from './store-ended-access.ts';
import {
  checkQuotaInput,
  hasRows,
  insertPairingRequest,
  insertSession,
  insertTicket,
  livePairingRequest,
  nextLapseOf,
  recordApprovedPairing,
  sweepLapsed,
  takeQuotaUses,
} from './store-statements.ts';

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

  // Sets the alarm for the next lapse (store-statements.ts), or clears it when nothing will lapse.
  async #schedule(): Promise<void> {
    const at = nextLapseOf(this.#sql);
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
    const { name, now } = input;
    this.#ensure(input.personId);
    const live = livePairingRequest(this.#sql, input);
    if (live) {
      if (name !== null && name !== live.name)
        this.#sql.exec('UPDATE wb_pairing_requests SET name = ? WHERE code = ?', name, live.code);
      return { code: live.code as string, expiresAt: live.expires_at as number, reused: true };
    }
    const code = randomBase64Url(WORKBENCH_PAIRING_CODE_BYTES);
    const expiresAt = now + (input.ttlMs ?? WORKBENCH_PAIRING_TTL_MS);
    insertPairingRequest(this.#sql, code, input, expiresAt);
    await this.#schedule();
    return { code, expiresAt, reused: false };
  }

  async readPairingRequest(code: string, now: number): Promise<PairingRequestRead | null> {
    if (!this.#started()) return null;
    const row = this.#first(
      `SELECT app, token_id, origin, name, scope, status, expires_at FROM wb_pairing_requests WHERE code = ?`,
      code,
    );
    return row ? toPairingRequest(row, now) : null;
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
    recordApprovedPairing(this.#sql, request, now);
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
    this.#ensure(input.personId);
    const pairing = await this.readPairing(input.pairingId);
    if (!pairing) return null;
    const ticket = `${randomBase64Url(WORKBENCH_TICKET_BYTES)}.${this.#id}`;
    insertTicket(this.#sql, await sha256Hex(ticket), pairing, input);
    await this.#schedule();
    return { ticket, expiresAt: input.expiresAt };
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
    return { ok: true, ticket: toConsumedTicket(row, this.#owner()) };
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
    this.#ensure(input.personId);
    const pairing = await this.readPairing(input.pairingId);
    if (!pairing) return null;
    const id = crypto.randomUUID();
    const secret = `${WORKBENCH_SESSION_PREFIX}${randomBase64Url(WORKBENCH_SESSION_SECRET_BYTES)}.${this.#id}`;
    insertSession(this.#sql, id, await sha256Hex(secret), pairing, input);
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
    return row ? toSessionRead(row, this.#owner()) : null;
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

    const rooms = roomsOfEndedAccess(pairings, sessions, joined, reason);
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
    checkQuotaInput(max, windowMs, count);
    this.#ensure(personId);
    const taken = takeQuotaUses(this.#sql, { kind, max, windowMs, now, count });
    if (taken === 0) return 0;
    await this.#schedule();
    return taken;
  }

  // ----- Upkeep -----

  async #drop(): Promise<void> {
    await this.#storage.deleteAlarm();
    await this.#storage.deleteAll();
    this.#ready = false;
    this.#person = null;
  }

  // After rows went: a store left with nothing deletes itself, any other sets its alarm for what is left to lapse.
  async #settle(): Promise<void> {
    if (!hasRows(this.#sql)) await this.#drop();
    else await this.#schedule();
  }

  // The alarm: what has lapsed goes, then the alarm is set for the next lapse, or cleared.
  async alarm(now = Date.now()): Promise<{ swept: number }> {
    // This alarm has fired: whatever is set next is for what is left.
    await this.#storage.deleteAlarm();
    if (!this.#started()) return { swept: 0 };
    const swept = sweepLapsed(this.#sql, now);
    await this.#settle();
    return { swept };
  }
}

export {
  WORKBENCH_SESSION_PREFIX,
  WORKBENCH_TICKET_BYTES,
  WORKBENCH_PAIRING_CODE_BYTES,
  WORKBENCH_SESSION_SECRET_BYTES,
  WORKBENCH_PAIRING_TTL_MS,
  WORKBENCH_SESSION_GRACE_MS,
  WORKBENCH_QUOTA_MAX,
  WORKBENCH_SESSION_ROOMS_MAX,
  WORKBENCH_TICKET_PATTERN,
  WORKBENCH_SESSION_PATTERN,
  WORKBENCH_CODE_PATTERN,
  randomBase64Url,
  sha256Hex,
  storeIdOfSecret,
  sessionPrefixOf,
  type WorkbenchLevel,
  type WorkbenchScope,
  type WorkbenchReach,
  type WorkbenchPairingRow,
  type PairingStatus,
  type PairingRequestRead,
  type PairingAnswer,
  type InvalidTicketReason,
  type ConsumedTicket,
  type WorkbenchSessionRead,
  type WorkbenchEndTarget,
  type WorkbenchEndReason,
  type RoomsToClose,
  type EndedAccess,
  type SqlExec,
  type WorkbenchStorage,
} from './store-types.ts';
export { pairingCovers } from './store-schema.ts';
export {
  type WorkbenchStoreApi,
  type WorkbenchNamespace,
  workbenchStoreOf,
  workbenchStoreOfSecret,
} from './store-stub.ts';
