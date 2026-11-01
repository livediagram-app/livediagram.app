import {
  createItemHeadSync,
  earliestRoomGrantDue,
  FLUSH_IDLE_MS,
  FLUSH_RETRY_MS,
  type ItemHeadSync,
  nextFlushAt,
  owesShares,
  recordItemEditor,
  renewRoomGrant,
  roomGrantStep,
  ShareSchedule,
} from '@liveworkspace/index-app';
import { DurableObject } from 'cloudflare:workers';
import {
  ACCESS_CHANGED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_GRANT_ASK_BEFORE_MS,
  WORKBENCH_ENDED_CLOSE,
  DOCUMENT_FORMAT,
  DOCUMENT_TRASHED_CLOSE,
  isRoomOpRef,
  parseBuildId,
  ROOM_FULL_CLOSE,
  ROOM_FULL_REASON,
  ROOM_PING,
  ROOM_PONG,
  roomIsFull,
  type AccessLevel,
} from '@livediagram/api-schema';
import { opForTheWire, stampCommentAuthor } from '@livediagram/document';
import { RoomParticipantWrites } from '../room-participant';
import { RoomLedgerStore } from '../room-ledger-store';
import { RoomLivePoll } from '../room-live-poll';
import { RoomSelectionStore, selectionFromOp, type LiveSession } from '../room-selections';
import {
  agentPresenceLog,
  answerAgentPresence,
  clearAgentsForOp,
  RoomAgentPresence,
} from '@liveworkspace/api-kit/room-agent-presence';
import type { ClientMessage, DocumentEnv, Env, ParticipantPresence, ServerMessage } from '../types';
import { reportServerEvent } from '../server-telemetry';
import { multiplayerDecision } from '@liveworkspace/api-kit/room-multiplayer';
import {
  type LoggedOp,
  MAX_TAB_ID_LEN,
  admitFrame,
  helloPresence,
  resolveCatchup,
} from '../document-room-rules';
import { followerIdsOf, followTargetOf } from '@liveworkspace/api-kit/room-follows';
import { opForScope, scopedTabOp } from '../room-scope';
import { gateClientOp } from '../room-op-gate';
import { ROOM_ELEMENT_RULES } from '../room-element-rules';
import { createRoomElementGate } from '@liveworkspace/api-kit/room-element-ops';
import { answerInternal, type InternalRoom } from '../room-internal';
import { rosterFrames, type RosterEntry } from '../room-roster';
import {
  sessionMatchesAccessClose,
  type AccessCloseMatch,
} from '@liveworkspace/api-kit/room-access';
import type { FacilitatorState } from '../facilitator';
import { RoomFacilitator } from '../room-facilitator';

import { writeQaAction, type QaWriteRequest } from '../qa-board-write';
import {
  newSessionAttachment,
  readSessionAttachment,
  verifiedSessionOf,
  type SessionAttachment,
} from '../room-session';

import { CHANGESET_RETENTION_MS, type CommunityAuthor } from '@livediagram/api-schema';
import { deleteOldChangesets } from '../db/changesets';
import { documentHasTab } from '../db/tabs';
import { documentPlacesImage } from '../db/image-refs';
import { documentMayServeImage } from '../db/image-grants';
import { indexService } from '../index-service';
import { notifyDocumentJoin, notifyMentioned } from '../email/notifications';
import { actionNotices, type NoticeDocument } from '../liveworkspace/action-notices';
import type { ActionNotice, MentionNotice } from '../document-client';
import {
  checkCommunityPost,
  COMMUNITY_CHECK_MS as COMMUNITY_CHECK_EVERY_MS,
  communityCheckDueAt,
  communityPostAuthor,
  openCommunityCode,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import { communityService, communityServiceConfigured } from '../community-service';
import { anonymiseDocument } from './document-anonymise';
import { drawDocument } from '../thumbnail';
import {
  ItemDb,
  type ExportCommentsResult,
  type ExportQuery,
  type ExportResult,
} from '@liveworkspace/index-app';
import { hasDocumentSchema, migrateDocumentSchema } from './document-schema';
import {
  exportDocumentCopy,
  importDocumentCopy,
  readDocumentHead,
  readDocumentMeta,
  readDocumentOutline,
  type DocumentCopy,
  type DocumentMeta,
  type DocumentOutline,
} from './document-content';
import { DOCUMENT_OUTBOX, drainOutbox } from './document-outbox';
import { exportDocumentFile, importDocumentFile, type DocumentFileImport } from './document-file';
import { exportDocumentComments } from './document-comments';
import { importMigratedDocument } from './document-migration';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import {
  documentShares,
  type ShareAnswer,
  type ShareMessage,
  type SharedTabCopy,
} from './tab-shares';
import { documentRoom } from '../document-client';
import { answerDocumentRequest, isDocumentCreate, type RouteIdentity } from './document-route';

// One SQLite-backed Durable Object per document id (docs/specs/015-api/api.md "Storage" and "Realtime model"). It
// is two things at once:
//
//   - The document's content: tabs (with their stats) and the changeset log, in its own SQLite
//     (document-schema.ts), which the content modules reach as `env.DOCUMENT_DB` (@liveworkspace/index-app item-db.ts). Every API
//     request about the document runs here (`route`, document-route.ts), so a save is one call to this object and
//     one SQLite transaction, with no round trip on its path. What other services need (the index's summary, the
//     Inbox's comments and actions, who edited it, the media service's image references) is pushed from the
//     outbox on idle (document-outbox.ts).
//   - The realtime room: connected WebSockets and their identity, presence, and the ordered op stream. It
//     classifies each op by kind, orders mutations (seq within an epoch, kept in storage), rewrites comment
//     authors, and keeps collaboration state (the ledger, the live poll, the facilitator baton). Payloads stay
//     `op: unknown` so the editor can evolve its vocabulary without changing the room. Two edits to the same
//     element are last-writer-wins in room order.
//
// Duration cost: the object is billed while it runs a request or an alarm, not while sockets idle (hibernation,
// below). Content requests and thumbnail renders now run here rather than in the worker, so a document with heavy
// API traffic keeps its object awake for that traffic; an idle document costs nothing.
//
// WebSocket HIBERNATION (why this shape): sockets are accepted via
// `state.acceptWebSocket()` and events arrive through the class-level
// `webSocketMessage` / `webSocketClose` / `webSocketError` handlers
// instead of per-socket `addEventListener`. That lets the runtime evict
// the DO from memory between messages while keeping every client's
// WebSocket open — an idle room (people connected, nobody moving a
// cursor) stops accruing duration billing instead of pinning the DO
// for the life of the longest session. The trade-offs this forces:
//
//   - Per-session state must survive eviction, so it lives in each
//     socket's serialized attachment (see SessionAttachment below),
//     not in an in-memory Map keyed by socket.
//   - Anything left in memory silently resets when the DO hibernates
//     and wakes (the constructor re-runs). Only `opRates` lives there,
//     and that reset is deliberately acceptable — see its comment.
//   - The keepalive is a `setWebSocketAutoResponse` pair (ROOM_PING answered
//     with ROOM_PONG, room-messages.ts): the runtime answers it without waking
//     the DO, so a client can learn its socket is still alive (or find out it
//     died silently, a laptop asleep or a NAT that dropped the connection)
//     without costing the room a wake per ping.

// Max ops a single session may broadcast per 1s window. Far above any
// legit client (cursor / laser broadcasts are throttled to a few dozen
// per second), so this only ever bites a flood.
const OP_RATE_CAP = 240;
// What the export door answers a drawing as.
const SVG_CONTENT_TYPE = 'image/svg+xml; charset=utf-8';

// Max size (chars) of a single inbound WebSocket frame. A cursor / select /
// op frame is well under this; the cap stops a socket from broadcasting a
// huge payload to every peer in the room.
const MAX_MESSAGE_CHARS = 256 * 1024;

// Length clamp on the tab id we persist into the attachment from hello /
// tab-focus frames. Real tab ids are UUIDs (36 chars); the clamp only
// exists so a hostile frame can't balloon the attachment (see the size
// note on SessionAttachment). MAX_TAB_ID_LEN comes from ./document-room-rules,
// which owns the clamp it applies to a hello frame's tabId.

// How many recent mutation ops the room keeps for reconnect catch-up
// (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1). A reconnecting client within this many ops of the
// live tail replays the delta; further behind, it re-hydrates from the document's stored tabs.
// Bounded so an idle-but-connected room can't grow the buffer without end;
// the log lives in memory (like opRates) and resets on hibernation, which
// only ever forces the safe path (a resync), never data loss.
const OP_LOG_LIMIT = 256;

// DO storage key holding `{ epoch, seq }` so the room keeps its ordering
// identity across a hibernation wake (docs/specs/012-collaboration/resync-without-reload.md).
const ORDER_STATE_KEY = 'order-state';

// Share-link ops that end the sessions their code admitted.
const SHARE_LINK_OPS = new Set(['share-revoked', 'share-rescoped']);
// Close code for a socket whose share link was revoked or rescoped. In the
// 4000-4999 application range; the client reloads or leaves on the op itself.
const SHARE_LINK_CHANGED_CLOSE = 4003;

// How long the outbox waits after a write before it pushes, the least gap between two pushes, and the retry after a
// failed one: @liveworkspace/index-app's (outbox.ts), the same for every app's items.
export { FLUSH_IDLE_MS, FLUSH_MIN_GAP_MS } from '@liveworkspace/index-app';
// The document's own daily upkeep: old changesets go. An empty canvas is moved to the Trash by the index's daily
// empty clean-up, from the summary's `hasContent` (docs/specs/013-workspace/empty-document-cleanup.md).
export const MAINTENANCE_EVERY_MS = 24 * 60 * 60 * 1000;
const MAINTENANCE_KEY = 'maintenance-at';

export class DocumentRoom extends DurableObject<Env> {
  // The object's state under the name the room's code has always used for it (`this.ctx` is the same).
  state: DurableObjectState;
  // Per-session op-rate window (sliding 1s) so one connected peer can't
  // flood the room. Legit cursor / laser / edit ops are client-throttled
  // well under the cap; over-cap ops are silently dropped, not a
  // disconnect, so a brief burst just thins rather than kicking the peer.
  //
  // Deliberately in-memory (NOT in the attachment): hibernation resets it,
  // which merely re-opens a fresh 1s window on wake — the cap is a flood
  // gate, not an accounting ledger, and a flood keeps the DO awake anyway
  // so the window never resets mid-flood. Persisting it would add an
  // attachment write per frame for nothing. Entries are cleaned on
  // close / error / dead-send so the map can't leak across a long-lived
  // in-memory period.
  opRates: Map<WebSocket, { count: number; windowStart: number }> = new Map();

  // Ordering state for reconnect catch-up (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1).
  //
  // `epoch` + `seq` are PERSISTED (docs/specs/012-collaboration/resync-without-reload.md); `opLog` is not. This split used
  // to be "all three in memory", on the reasoning that a hibernation wake
  // only ever forces a resync, which is safe and rare. The first half held;
  // the second didn't. Hibernation is routine — it's the whole point of the
  // WebSocket Hibernation API — so every wake minted a fresh epoch, and any
  // client that reconnected afterwards mismatched and resynced. Live
  // telemetry had `RealtimeResync` as the single most common client error.
  //
  // With both values restored on wake, a client that reconnects fully
  // caught-up matches the epoch AND satisfies `lastSeq >= this.seq`, so it
  // gets an empty delta instead of a resync. The cost is one storage write
  // per mutation op, which is dwarfed by the fan-out broadcast beside it.
  //
  // `opLog` stays in memory: it's a replay buffer, and a client that fell
  // behind across a wake genuinely did miss ops it can no longer be sent.
  // `floor` in sendCatchup already reports an empty log honestly, so that
  // client still resyncs — correctly, and now only when it really must.
  seq = 0;
  opLog: LoggedOp[] = [];
  // Stable for the life of the room, not per DO instantiation. Scopes seq
  // numbers: a client compares the epoch on an incoming op against the last
  // it saw to know whether the room restarted (seq reset) versus advanced.
  epoch: string = crypto.randomUUID();
  // Who is running the session (docs/specs/012-collaboration/facilitator.md), restored in the constructor.
  private baton: RoomFacilitator;
  get facilitator(): FacilitatorState {
    return this.baton.state;
  }
  // The collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3) and the running poll
  // (docs/specs/012-collaboration/collab-race-hardening.md), each in its own module; see room-ledger-store / room-live-poll.
  ledger: RoomLedgerStore;
  poll: RoomLivePoll;
  // The poll answers in flight, in arrival order (relayPollAnswer). Awaited by tests.
  pollAnswers: Promise<void>;
  // Each session's selection, for the api's held check (room-selections.ts).
  selections: RoomSelectionStore;
  // Agent presence entries (docs/specs/024-agents/agent-presence.md "Presence").
  agents: RoomAgentPresence;

  // The env the document's code runs with here: the worker's bindings, its own SQLite as `DOCUMENT_DB`, and a
  // DOCUMENT_ROOM that answers this document's own id with this object (no hop). Undefined only for a unit test that
  // builds a room from a fake state alone; then the content and telemetry paths are skipped.
  roomEnv: DocumentEnv | undefined;
  // The document's SQLite behind the D1-shaped surface the content modules use (@liveworkspace/index-app item-db.ts).
  readonly db: ItemDb;
  // The document this object is, from the first call that names it (every RPC and room join does).
  private documentId: string | null = null;
  private schemaReady = false;
  private documentRowReady = false;
  // The outbox's next push (null: nothing pending), the last one, and whether one is running now.
  private flushAt: number | null = null;
  private lastFlushAt = 0;
  private draining = false;
  // The next send to the other holders of its shared tabs (tab-shares.ts): on idle, not held to the outbox's
  // once a minute, since it is a call to another document rather than a push.
  private readonly shares = new ShareSchedule(
    () => this.schemaReady && owesShares(this.state.storage.sql),
  );
  // The next daily upkeep (persisted, so a wake keeps the day).
  private maintenanceAt: number | null = null;
  // Content writes so far (noteWrite), so route() can tell a request that wrote from one that didn't.
  private writes = 0;
  // The canvas's Community post as last read (null: none), and when it next asks where it stands.
  private communityAt: number | null = null;
  // The canvas's owner and team, kept from every grant the room is handed (a socket's ticket, a renewal, an API
  // request's grant), so a guest's merge into an account or a move to another team reaches the canvas's emails,
  // pushes and alarm (@liveworkspace/index-app item-head.ts).
  private readonly head: ItemHeadSync;

  // The Q&A board write queue (docs/specs/012-collaboration/qa-board.md). Every board write for this document
  // runs through here ONE AT A TIME. A Durable Object only serialises the
  // synchronous parts of its handlers: while one write is awaiting D1, the
  // runtime happily starts the next request, and two read-modify-writes of the
  // same row would be exactly the race that once cost the dot vote its votes.
  // In memory because a queue only matters while requests are in flight; a
  // hibernation wake has none.
  // The tab write queue (blueprint SR2): Q&A board writes and a Participant's writes, one at a time per document.
  private tabWriteQueue: Promise<unknown> = Promise.resolve();
  // The surface the api worker's internal endpoints act on (room-internal.ts).
  private readonly internal: InternalRoom;
  // A Participant's content and answers (docs/specs/013-workspace/share-roles.md), see room-participant.ts.
  private participantWrites: RoomParticipantWrites;

  constructor(state: DurableObjectState, env?: Env) {
    super(state, env as Env);
    this.state = state;
    this.db = new ItemDb(state.storage.sql, {
      transaction: (fn) => state.storage.transactionSync(fn),
      ensureSchema: () => this.ensureSchema(),
      onWrite: () => this.noteWrite(),
    });
    this.roomEnv = env
      ? {
          ...env,
          DOCUMENT_DB: this.db.asD1(),
          DOCUMENT_ROOM: this.localNamespace(env.DOCUMENT_ROOM),
          ROOM_PEOPLE: () => this.roomPeople(),
        }
      : undefined;
    this.ledger = new RoomLedgerStore(state.storage);
    this.head = createItemHeadSync({
      read: async () => {
        if (this.documentId === null || !this.hasSchema()) return null;
        this.ensureSchema();
        const row = state.storage.sql
          .exec<{ owner_id: string; team_id: string | null }>(
            'SELECT owner_id, team_id FROM document WHERE id = ? AND created_at > 0',
            this.documentId,
          )
          .toArray()[0];
        return row ? { ownerId: row.owner_id, teamId: row.team_id ?? null } : null;
      },
      write: async (h) => {
        state.storage.sql.exec(
          'UPDATE document SET owner_id = ?, team_id = ? WHERE id = ?',
          h.ownerId,
          h.teamId,
          this.documentId,
        );
        console.info('[room] owner or team taken from the grant', { team: h.teamId !== null });
        // The summary push names the owner; a team change can open or close a Community post.
        state.storage.sql.exec(
          "INSERT OR IGNORE INTO outbox (document_id, kind, key) VALUES (?, 'summary', '')",
          this.documentId,
        );
        this.noteWrite();
        if (this.communityAt !== null) this.communityAt = Date.now();
      },
    });
    this.participantWrites = new RoomParticipantWrites({
      env: this.roomEnv,
      enqueue: (step) => this.queueTabWrite(step),
      sequence: (from, op, except) => this.sequenceMutation(from, op, except),
      sendTo: (ws, payload) => this.sendTo(ws, payload),
      position: () => ({ epoch: this.epoch, seq: this.seq }),
      readLedger: (tabId) => this.ledger.read(tabId),
    });
    this.poll = new RoomLivePoll(state.storage);
    this.internal = {
      broadcastSystemOp: (op) => this.broadcastSystemOp(op),
      broadcastOrderedSystemOp: (op) => this.broadcastOrderedSystemOp(op),
      closeSessionsOfChangedLink: (op) => this.closeSessionsOfChangedLink(op),
      closeAllIfTrashed: (op) => this.closeAllIfTrashed(op),
      clearAgentsFor: (op) => this.clearAgentsFor(op),
      closeSessionsForAccessChange: (close) => this.closeSessionsForAccessChange(close),
      purge: () => this.purge(),
      handleAgentPresence: (req, u) => this.handleAgentPresence(req, u),
      handleQaWrite: (req) => this.handleQaWrite(req),
      sequenceMutation: (from, op) => this.sequenceMutation(from, op),
      readSelections: (tabId, person) => this.selections.read(tabId, this.liveSessions(), person),
      readLedger: (tabId) => this.ledger.read(tabId),
      epoch: () => this.epoch,
    };
    this.baton = new RoomFacilitator({
      storage: state.storage,
      broadcast: (payload, except) => this.broadcast(payload, except),
      sendTo: (ws, payload) => this.sendTo(ws, payload),
      sendToPresence: (presenceId, payload) => this.sendToPresence(presenceId, payload),
      socketByPresence: (presenceId) => this.socketByPresence(presenceId),
      readSession: (ws) => this.readSession(ws),
      armAlarm: () => this.armAlarm(),
    });
    this.pollAnswers = Promise.resolve();
    this.selections = new RoomSelectionStore(state.storage);
    // The keepalive (see the hibernation notes above): answered by the runtime, never by this class. Absent from a
    // test double of the state, and from a runtime without the hibernation API.
    if (typeof WebSocketRequestResponsePair !== 'undefined')
      state.setWebSocketAutoResponse?.(new WebSocketRequestResponsePair(ROOM_PING, ROOM_PONG));
    this.agents = new RoomAgentPresence(
      state.storage,
      () => Date.now(),
      () => crypto.randomUUID(),
    );
    // Restore before any request can observe `epoch`/`seq`. A wake re-runs
    // the constructor, so without this gate a socket could be handed the
    // freshly-minted field values above and defeat the whole point.
    void state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<{ epoch: string; seq: number }>(ORDER_STATE_KEY);
      if (saved) {
        this.epoch = saved.epoch;
        this.seq = saved.seq;
      } else {
        // First instantiation for this document: adopt the random epoch above.
        await state.storage.put(ORDER_STATE_KEY, { epoch: this.epoch, seq: this.seq });
      }
      await this.baton.restore();
      await this.poll.restore();
      for (const r of await this.agents.restore()) agentPresenceLog('expired', r);
      this.restoreContentState(await state.storage.get<number>(MAINTENANCE_KEY));
      this.armAlarm();
    });
  }

  // ---------- The document's content ----------------------------------------------------------------------

  // After a wake: the document id, anything the outbox still owes, and its Community post's next check. Reads only;
  // a document with no schema yet (an id nothing has written) stays without one.
  private restoreContentState(maintenanceAt: number | undefined): void {
    this.maintenanceAt = maintenanceAt ?? null;
    const sql = this.state.storage.sql;
    if (!sql || !hasDocumentSchema((q) => sql.exec(q))) return;
    this.ensureSchema();
    const row = sql.exec('SELECT id FROM document LIMIT 1').toArray()[0];
    if (typeof row?.id === 'string' && this.documentId === null) this.documentId = row.id;
    if (this.owesIndex()) this.flushAt = Date.now();
    this.shares.restore();
    const post = sql
      .exec<{ checked_at: number }>('SELECT checked_at FROM community_post LIMIT 1')
      .toArray()[0];
    this.communityAt = post ? post.checked_at + COMMUNITY_CHECK_EVERY_MS : null;
  }

  // A tab's stored name, or null when the store holds no such tab (or no document yet). One primary-key read.
  private storedTabName(tabId: string): string | null {
    const sql = this.state.storage.sql;
    if (!sql || !this.hasSchema()) return null;
    const row = sql
      .exec<{ name: string }>('SELECT name FROM tabs WHERE id = ?', tabId)
      .toArray()[0];
    return typeof row?.name === 'string' ? row.name : null;
  }

  private hasSchema(): boolean {
    const sql = this.state.storage.sql;
    return this.schemaReady || (!!sql && hasDocumentSchema((q) => sql.exec(q)));
  }

  // Every call names its document; an object answers for one document only.
  private bindDocument(documentId: string): void {
    if (this.documentId === null) this.documentId = documentId;
    else if (this.documentId !== documentId)
      throw new Error('document id does not match this object');
  }

  // The schema on first use (document-schema.ts), and the document's row once its id is known, so the content's
  // foreign keys always find it. A row made here has no dates (0): a create or a copy sets them, and the
  // summary push never moves saved_at back.
  private ensureSchema(): void {
    if (this.schemaReady && (this.documentRowReady || this.documentId === null)) return;
    const sql = this.state.storage.sql;
    if (!this.schemaReady) {
      migrateDocumentSchema((q) => sql.exec(q));
      this.schemaReady = true;
    }
    if (this.documentId !== null && !this.documentRowReady) {
      sql.exec(
        'INSERT OR IGNORE INTO document (id, saved_at, created_at) VALUES (?, 0, 0)',
        this.documentId,
      );
      this.documentRowReady = true;
    }
  }

  // A content write happened: push to the index and the media service on idle, at most once a minute
  // (document-outbox.ts), and send a shared tab's holders their copy on idle. Writes the drain itself makes (its
  // outbox delete) schedule nothing.
  private noteWrite(): void {
    if (this.draining) return;
    this.writes++;
    if (this.maintenanceAt === null) {
      this.maintenanceAt = Date.now() + MAINTENANCE_EVERY_MS;
      void this.state.storage.put(MAINTENANCE_KEY, this.maintenanceAt);
      this.armAlarm();
    }
    const now = Date.now();
    if (this.shares.noteWrite()) this.armAlarm();
    if (this.flushAt !== null || !this.owesIndex()) return;
    this.flushAt = nextFlushAt(now, this.lastFlushAt);
    this.armAlarm();
  }

  // Push what the outbox holds to the index and the media service, and send what the shared tabs' holders are owed,
  // now. A failure keeps it and retries later.
  async drain(): Promise<void> {
    await this.drainIndex();
    await this.drainShares();
  }

  private async drainIndex(): Promise<void> {
    const env = this.roomEnv;
    const documentId = this.documentId;
    this.flushAt = null;
    if (!env || !documentId || !this.schemaReady) return;
    this.draining = true;
    try {
      const { keys, pushes, more } = await drainOutbox(env, documentId);
      this.lastFlushAt = Date.now();
      if (keys > 0) console.debug('[document-outbox] pushed', { documentId, keys, pushes });
      // A big import's tabs go a batch at a time, back to back, not a minute apart.
      if (more) this.flushAt = Date.now() + FLUSH_IDLE_MS;
    } catch (error) {
      console.warn('[document-outbox] push failed', { documentId, error: String(error) });
      this.flushAt = Date.now() + FLUSH_RETRY_MS;
    } finally {
      this.draining = false;
    }
    // Anything written while the push was in flight goes next time.
    if (this.flushAt === null && this.owesIndex()) {
      this.flushAt = nextFlushAt(Date.now(), this.lastFlushAt);
    }
  }

  // Send the other holders of its shared tabs what they are owed (tab-shares.ts). A failure keeps it for later.
  private async drainShares(): Promise<void> {
    const env = this.roomEnv;
    const documentId = this.documentId;
    if (!env || !documentId || !this.schemaReady) {
      this.shares.clear();
      return;
    }
    this.draining = true;
    try {
      const done = await this.shares.send(() =>
        documentShares.drain(env, documentId, (to, messages) =>
          documentRoom(env, to).receiveShares(documentId, messages),
        ),
      );
      if (done && done.sent > 0)
        console.debug('[tab-shares] sent', { documentId, sent: done.sent });
    } finally {
      this.draining = false;
    }
    if (this.flushAt === null && this.owesIndex()) {
      this.flushAt = nextFlushAt(Date.now(), this.lastFlushAt);
    }
  }

  private owesIndex(): boolean {
    return this.state.storage.sql.exec('SELECT 1 FROM outbox LIMIT 1').toArray().length > 0;
  }

  // The document's daily upkeep, once a day per document with content: changesets past their retention go (CS28).
  private async maintain(now: number): Promise<void> {
    const env = this.roomEnv;
    const documentId = this.documentId;
    this.maintenanceAt = now + MAINTENANCE_EVERY_MS;
    await this.state.storage.put(MAINTENANCE_KEY, this.maintenanceAt);
    if (!env || !documentId || !this.schemaReady) return;
    try {
      const gone = await deleteOldChangesets(env, now - CHANGESET_RETENTION_MS);
      if (gone > 0) console.info('[changeset] retention', { documentId, deleted: gone });
    } catch (error) {
      console.warn('[document-room] upkeep failed', { documentId, error: String(error) });
    }
  }

  // This env's DOCUMENT_ROOM, answering this document's own id with this object: the code shared with the worker (a
  // document read's outline, the room relays) then calls straight in rather than through a stub.
  private localNamespace(
    real: DurableObjectNamespace<DocumentRoom> | undefined,
  ): DurableObjectNamespace<DocumentRoom> {
    const ns = (real ?? {}) as DurableObjectNamespace<DocumentRoom>;
    return new Proxy(ns, {
      get: (target, prop, receiver) => {
        if (prop === 'get') {
          return (id: DurableObjectId, opts?: DurableObjectNamespaceGetDurableObjectOptions) =>
            id.equals(this.state.id) ? this : target.get(id, opts);
        }
        const value: unknown = Reflect.get(target, prop, receiver);
        return typeof value === 'function'
          ? (value as (...a: unknown[]) => unknown).bind(target)
          : value;
      },
    });
  }

  // ---------- RPC: what the worker asks of a document (document-client.ts) ---------------------------------------

  async outline(documentId: string): Promise<DocumentOutline> {
    this.bindDocument(documentId);
    return readDocumentOutline(this.requireEnv(), documentId);
  }

  async route(documentId: string, request: Request, identity: RouteIdentity): Promise<Response> {
    this.bindDocument(documentId);
    const env = this.requireEnv();
    if (identity.grant?.item === documentId) await this.takeHead(identity.grant);
    const community = await this.communityOf(documentId);
    const writesBefore = this.writes;
    const response = await answerDocumentRequest(
      env,
      request,
      identity,
      (p) => this.state.waitUntil(p),
      community,
    );
    // A request that wrote is an edit by whoever asked: their Timeline entry and a Most Used day
    // (@liveworkspace/index-app recordItemEditor). Reads, refusals and requests that changed nothing are not, nor is
    // the create, the canvas's making (isDocumentCreate).
    if (response.ok && identity.owner && this.writes > writesBefore) {
      if (!isDocumentCreate(request)) {
        const sql = this.state.storage.sql;
        recordItemEditor(
          (q, ...b) => sql.exec(q, ...b),
          DOCUMENT_OUTBOX,
          documentId,
          identity.owner,
          Date.now(),
        );
      }
      this.noteWrite();
    }
    // A post published or removed by this request starts or stops its checks.
    if (request.method !== 'GET' && new URL(request.url).pathname.endsWith('/community'))
      this.communityAt = communityCheckDueAt(await readCommunityPost(env));
    this.armAlarm();
    return response;
  }

  // The canvas's Community post's link as the doors read it: its code, and whether it opens the canvas now
  // (community-post.ts openCommunityCode). Null for a canvas with no post.
  async community(documentId?: string): Promise<{ code: string; open: boolean } | null> {
    if (documentId !== undefined) this.bindDocument(documentId);
    if (this.documentId === null || !this.hasSchema()) return null;
    return this.communityOf(this.documentId);
  }

  private async communityOf(documentId: string): Promise<{ code: string; open: boolean } | null> {
    if (!this.hasSchema()) return null;
    const env = this.requireEnv();
    const post = await readCommunityPost(env);
    if (!post) return null;
    const meta = await readDocumentMeta(env, documentId);
    return { code: post.shareCode, open: openCommunityCode(env, post, meta) === post.shareCode };
  }

  // What a visitor through the canvas's Community post's open link is told of the post (docs/specs/025-community/
  // community.md "Viewing a post's document"): its id at the service and who it shows as author. Null when `code`
  // is not the post's link or the post does not open the canvas now.
  async communityListing(
    documentId: string,
    code: string,
  ): Promise<{ postId: string; author: CommunityAuthor } | null> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return null;
    const env = this.requireEnv();
    const post = await readCommunityPost(env);
    if (!post || post.shareCode !== code) return null;
    const meta = await readDocumentMeta(env, documentId);
    if (openCommunityCode(env, post, meta) !== code) return null;
    return { postId: post.postId, author: await communityPostAuthor(env, post) };
  }

  // A copy through the canvas's Community post's link is named after the post (docs/specs/025-community/
  // community.md "Making a copy"): its title, when `code` is the post's link and the post is open. Null otherwise.
  async communityPostTitle(documentId: string, code: string): Promise<string | null> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return null;
    const env = this.requireEnv();
    const post = await readCommunityPost(env);
    if (!post || post.shareCode !== code) return null;
    const meta = await readDocumentMeta(env, documentId);
    return openCommunityCode(env, post, meta) ? post.title : null;
  }

  // Take the owner and team a grant names as the canvas's own copy. A failure is logged, never the caller's: the
  // next grant tries again.
  private async takeHead(grant: { owner?: string | null; team: string | null }): Promise<void> {
    if (!this.roomEnv) return;
    try {
      await this.head.sync(grant);
    } catch (err) {
      console.warn('[room] owner and team not taken from the grant', { error: String(err) });
    }
  }

  // The export door (liveworkspace/docs/specs/006-media/previews.md, routes/internal-items.ts): the canvas drawn as an SVG, the first
  // tab or one, with its last save as the version. Through the canvas's Community post's link it is the redacted
  // drawing, and nothing while the post does not open the canvas. Unchanged since `ifVersion`, it is not drawn.
  async exportImage(documentId: string, query: ExportQuery): Promise<ExportResult> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return { status: 'not_found' };
    const env = this.requireEnv();
    const { meta, savedAt } = await readDocumentHead(env, documentId);
    if (!meta) return { status: 'not_found' };
    let community = false;
    if (query.code !== null) {
      const post = await readCommunityPost(env);
      if (post?.shareCode === query.code) {
        if (openCommunityCode(env, post, meta) !== query.code) return { status: 'not_found' };
        community = true;
      }
    }
    if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
    if (query.tabId !== null && !(await documentHasTab(env, documentId, query.tabId))) {
      return { status: 'not_found' };
    }
    const svg = await drawDocument(
      env,
      { id: documentId, name: meta.name },
      query.tabId,
      { defer: (p) => this.state.waitUntil(p), appearance: query.appearance },
      community,
    );
    return svg === null
      ? { status: 'empty', version: savedAt }
      : { status: 'ok', body: svg, contentType: SVG_CONTENT_TYPE, version: savedAt };
  }

  // The export door's `file` format (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps", document-file.ts): the
  // canvas's whole envelope, its last save as the version, unread when the caller holds that save.
  async exportFile(documentId: string, query: ExportQuery): Promise<ExportResult> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return { status: 'not_found' };
    return exportDocumentFile(this.requireEnv(), documentId, query.ifVersion);
  }

  // The export door's `comments` format (liveworkspace/docs/specs/003-accounts/data-export.md "The apps' doors",
  // document-comments.ts): every thread in the canvas with its real authors, for the data export. A canvas never
  // started is not found, and asking does not start it.
  async exportComments(documentId: string): Promise<ExportCommentsResult> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return { status: 'not_found' };
    return exportDocumentComments(this.requireEnv(), documentId);
  }

  // A new canvas from a Drive file (routes/internal-file.ts read it): its tabs land as a copy's do, and it starts as
  // its owner's.
  async importFile(documentId: string, file: DocumentFileImport): Promise<void> {
    this.bindDocument(documentId);
    await importDocumentFile(this.requireEnv(), documentId, file);
  }

  async hasTab(documentId: string, tabId: string): Promise<boolean> {
    this.bindDocument(documentId);
    return documentHasTab(this.requireEnv(), documentId, tabId);
  }

  // Whether the canvas places this image (on one tab, for a tab-scoped visitor) and may serve it
  // (db/image-grants.ts): the byte endpoint's share check, answered where both live.
  async servesImage(
    documentId: string,
    imageId: string,
    onlyTabId: string | null,
  ): Promise<boolean> {
    this.bindDocument(documentId);
    const env = this.requireEnv();
    if (!(await documentPlacesImage(env, documentId, imageId, onlyTabId))) return false;
    return documentMayServeImage(env, documentId, imageId);
  }

  // The source side of a copy, for whoever copies (the index names them and the link they came through): anyone
  // but the owner takes the comments as the tab read serves them to them; a copy through the canvas's open
  // Community post's link takes it without its comments or the people on its actions (docs/specs/025-community/
  // community.md "Making a copy"). `community` says which, so the copy is counted toward the post.
  async exportCopy(
    documentId: string,
    onlyTabId: string | null,
    copier: { by: string | null; code: string | null } | null,
  ): Promise<{ copy: DocumentCopy; community: boolean } | null> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return null;
    const env = this.requireEnv();
    const meta = await readDocumentMeta(env, documentId);
    if (!meta) return null;
    const post = copier?.code ? await this.communityOf(documentId) : null;
    const community = post !== null && post.open && post.code === copier?.code;
    const by = copier?.by ?? null;
    const copy = await exportDocumentCopy(
      env,
      documentId,
      onlyTabId,
      by !== null && by !== meta.ownerId ? by : null,
      community,
    );
    return copy ? { copy, community } : null;
  }

  async importCopy(documentId: string, copy: DocumentCopy): Promise<void> {
    this.bindDocument(documentId);
    await importDocumentCopy(this.requireEnv(), documentId, copy);
  }

  // An old livediagram.app document's part (the migration door, document-migration.ts): one transaction, with its
  // own times; the outbox pushes it to the index and the media service as any write.
  async importMigrated(
    documentId: string,
    payload: MigrationRoomPayload,
  ): Promise<MigrationDoorAnswer> {
    this.bindDocument(documentId);
    this.requireEnv();
    return importMigratedDocument(this.db, payload);
  }

  // Share links the index revoked or rescoped: each one's sessions hear it and end now. `rescoped`: they reload
  // into what the link opens now.
  async revokeCodes(
    documentId: string,
    codes: string[],
    reason: 'revoked' | 'rescoped' = 'revoked',
  ): Promise<number> {
    this.bindDocument(documentId);
    let closed = 0;
    for (const code of codes) {
      const op = { kind: reason === 'rescoped' ? 'share-rescoped' : 'share-revoked', code };
      const before = this.state.getWebSockets().length;
      this.broadcastSystemOp(op);
      this.closeSessionsOfChangedLink(op);
      await this.clearAgentsFor(op);
      closed += before - this.state.getWebSockets().length;
    }
    return closed;
  }

  // Someone opened the canvas through a share link for the first time: the owner hears of it
  // (email/notifications.ts notifyDocumentJoin), off the caller's path. A canvas never started has no owner to tell.
  async joined(documentId: string, personId: string): Promise<void> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return;
    const env = this.requireEnv();
    const meta = await readDocumentMeta(env, documentId);
    if (!meta) return;
    this.state.waitUntil(
      notifyDocumentJoin(env, { id: documentId, ownerId: meta.ownerId, name: meta.name }, personId),
    );
  }

  // An action assigned or a comment's mentions (routes/team-notify-routes.ts checked the people and the canvas): the
  // emails go from here, off the caller's path, where their once-only claims are kept. A canvas never started has
  // nothing to name.
  async notifyAction(documentId: string, input: ActionNotice): Promise<boolean> {
    const document = await this.noticeDocument(documentId);
    if (!document) return false;
    for (const work of actionNotices(this.requireEnv(), document, input))
      this.state.waitUntil(work);
    return true;
  }

  async notifyMention(documentId: string, input: MentionNotice): Promise<boolean> {
    const document = await this.noticeDocument(documentId);
    if (!document) return false;
    this.state.waitUntil(
      notifyMentioned(this.requireEnv(), {
        ...input,
        document: { id: document.id, name: document.name },
      }).catch(() => {}),
    );
    return true;
  }

  private async noticeDocument(documentId: string): Promise<NoticeDocument | null> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return null;
    const meta = await readDocumentMeta(this.requireEnv(), documentId);
    return meta
      ? { id: documentId, name: meta.name, ownerId: meta.ownerId, teamId: meta.teamId }
      : null;
  }

  // A closed account's name off this canvas (document-anonymise.ts): the index's person purge, through the api.
  async anonymise(documentId: string, personId: string): Promise<number> {
    this.bindDocument(documentId);
    // A canvas never started (or purged) holds nothing of anyone: read its storage as it is, without making the
    // schema and document row a first query would.
    const sql = this.state.storage.sql;
    const started =
      this.hasSchema() &&
      sql.exec('SELECT 1 FROM document WHERE id = ? AND created_at > 0', documentId).toArray()
        .length > 0;
    if (!started) return 0;
    const changed = await anonymiseDocument(this.requireEnv(), documentId, personId);
    // The owner may have been the one anonymised: the next grant reads the stored copy again.
    this.head.forget();
    if (changed > 0) console.info('[room] anonymised a closed account', { rows: changed });
    return changed;
  }

  // ---------- RPC: a tab shared with other documents (tab-shares.ts) ----------------------------------------------

  // A document joining this tab's holders: the tab as held here and who holds it.
  async sharedTabCopy(documentId: string, tabId: string): Promise<SharedTabCopy | null> {
    this.bindDocument(documentId);
    return documentShares.copyOf(this.requireEnv(), documentId, tabId);
  }

  // `member` now holds the tab too.
  async shareJoined(
    documentId: string,
    tabId: string,
    member: string,
    seenUpdatedAt: number,
  ): Promise<boolean> {
    this.bindDocument(documentId);
    return documentShares.recordJoin(this.requireEnv(), documentId, tabId, member, seenUpdatedAt);
  }

  // What another holder of a shared tab sent. A document with nothing stored holds no tab, and makes no schema
  // to say so.
  async receiveShares(
    documentId: string,
    from: string,
    messages: ShareMessage[],
  ): Promise<ShareAnswer[]> {
    const sql = this.state.storage.sql;
    if (this.documentId === null && !hasDocumentSchema((q) => sql.exec(q))) {
      return messages.map(() => 'gone');
    }
    this.bindDocument(documentId);
    return documentShares.receive(this.requireEnv(), documentId, from, messages);
  }

  private requireEnv(): DocumentEnv {
    if (!this.roomEnv) throw new Error('document room has no env');
    return this.roomEnv;
  }

  // Record the seq we just handed out. Not awaited: the DO output gate holds
  // outbound messages until pending writes land, so a peer can never see an
  // op whose seq failed to persist.
  private persistOrder(): void {
    void this.state.storage.put(ORDER_STATE_KEY, { epoch: this.epoch, seq: this.seq });
  }

  // The room's own doors: its internal endpoints (room-internal.ts) and the WebSocket upgrade. Takes what a
  // stub's fetch takes, so the worker's relays (room-client.ts) call it the same way here as through a stub.
  override async fetch(input: Request | string, init?: RequestInit): Promise<Response> {
    const request = typeof input === 'string' || init ? new Request(input, init) : input;
    const url = new URL(request.url);
    const internal = await answerInternal(this.internal, request, url);
    if (internal) return internal;
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }
    const pair = new WebSocketPair();
    // WebSocketPair is a 2-property record keyed `0`/`1`. The "client"
    // side is returned to the connecting peer; the "server" side is
    // owned by this Durable Object.
    const client = pair[0];
    const server = pair[1];
    // A full room answers the upgrade and closes it at once (docs/specs/015-api/api.md "A room holds at most
    // 100 connections"): the close code is the only thing a browser can read, an HTTP refusal reads as 1006.
    if (this.turnAwayIfFull(server)) return new Response(null, { status: 101, webSocket: client });
    // Server-resolved facts (set by the api worker before forwarding the upgrade): room-session.ts.
    const v = verifiedSessionOf(request);
    this.acceptSession(
      server,
      v.verifiedRole,
      v.isOwner,
      v.tabScope,
      v.shareCode,
      v.personTag,
      v.networkTag,
      v.workbenchPairing,
      v.adderKey,
      v.documentId,
      v.grantExp ?? null,
    );
    if (v.documentId) {
      this.bindDocument(v.documentId);
      if (v.head) await this.takeHead(v.head);
    }
    this.armAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---------- Grants (liveworkspace/docs/specs/004-index/one-explorer-contracts.md "Grants") ---------------------------------
  //
  // Every session joined with the index's grant, which lapses after ten minutes. ROOM_GRANT_ASK_BEFORE_MS before
  // it does, the room asks the session for a fresh one (`grant-renew`); the session answers with a `grant` frame
  // (its editor renews a minute early anyway, and sends each new grant unasked). A session still holding a
  // lapsed grant is closed with GRANT_LAPSED_CLOSE, and its editor rejoins with a fresh one, or not at all. The
  // decisions are @liveworkspace/index-app's (room-ticket.ts).

  private nextGrantDue(): number | null {
    return earliestRoomGrantDue(
      this.state.getWebSockets().map((ws) => this.readSession(ws)),
      ROOM_GRANT_ASK_BEFORE_MS,
    );
  }

  // Ask the sessions whose grant is about to lapse, and close those whose grant has.
  private checkGrants(now: number): void {
    let lapsed = 0;
    for (const ws of this.state.getWebSockets()) {
      const s = this.readSession(ws);
      const step = roomGrantStep(s, now, ROOM_GRANT_ASK_BEFORE_MS);
      if (step === 'lapsed') {
        this.closeSockets((each) => (each === ws ? [GRANT_LAPSED_CLOSE, 'grant-lapsed'] : null));
        lapsed++;
      } else if (step === 'ask' && s?.grantExp) {
        this.sendTo(ws, { kind: 'grant-renew', expiresAt: s.grantExp });
        try {
          ws.serializeAttachment({ ...s, renewAsked: true } satisfies SessionAttachment);
        } catch {
          // The socket is going; its lapse closes it.
        }
      }
    }
    if (lapsed > 0) console.info('[grant] sessions lapsed', { closed: lapsed });
  }

  // A session's fresh grant (the `grant` frame): the same canvas, level and tab move its lapse on. One that says
  // something else (a level changed, a tab rescoped) ends the session, and the editor rejoins with what it holds
  // now. A grant that does not check is ignored; the old one still lapses.
  async renewGrant(ws: WebSocket, ticket: unknown): Promise<void> {
    const env = this.roomEnv;
    const session = this.readSession(ws);
    if (!env || !session?.documentId) return;
    const renewal = await renewRoomGrant(indexService, env, ticket, session.documentId, {
      level: session.verifiedRole,
      tab: session.tabScope,
    });
    if (renewal.kind === 'invalid') {
      console.warn('[grant] renewal refused', { reason: 'invalid' });
      return;
    }
    if (renewal.kind === 'changed') {
      console.info('[grant] renewal changed access', {
        from: session.verifiedRole,
        to: renewal.level,
      });
      this.closeSockets((each) => (each === ws ? [ACCESS_CHANGED_CLOSE, 'access-changed'] : null));
      return;
    }
    // A fresh grant on a canvas since moved to the Trash ends the session, as the trashing itself does.
    if (renewal.claims.trashed) {
      this.closeSockets((each) =>
        each === ws ? [DOCUMENT_TRASHED_CLOSE, 'document-trashed'] : null,
      );
      return;
    }
    await this.takeHead(renewal.claims);
    const current = this.readSession(ws);
    if (!current) return;
    try {
      ws.serializeAttachment({
        ...current,
        grantExp: renewal.grantExp,
        renewAsked: false,
      } satisfies SessionAttachment);
    } catch {
      return;
    }
    this.armAlarm();
  }

  // Turn an upgrade away when the room already holds ROOM_MAX_CONNECTIONS sockets: accepted only to be closed
  // with ROOM_FULL_CLOSE, never handed to the hibernation runtime, so it holds no session and receives nothing.
  turnAwayIfFull(server: WebSocket): boolean {
    const connections = this.state.getWebSockets().length;
    if (!roomIsFull(connections)) return false;
    console.warn('[room] full', { documentId: this.documentId, connections });
    server.accept();
    server.close(ROOM_FULL_CLOSE, ROOM_FULL_REASON);
    return true;
  }

  // Admit one server-side socket into the room: pin its hibernation-proof
  // session state (attachment) and hand it to the runtime. Split out of
  // fetch so tests can drive sessions without constructing WebSocketPair.
  acceptSession(
    ws: WebSocket,
    verifiedRole?: AccessLevel,
    isOwner = false,
    tabScope: string | null = null,
    shareCode: string | null = null,
    personTag: string | null = null,
    networkTag: string | null = null,
    workbenchPairing: string | null = null,
    adderKey: string | null = null,
    documentId: string | null = null,
    grantExp: number | null = null,
  ): void {
    ws.serializeAttachment(
      newSessionAttachment(
        {
          verifiedRole,
          isOwner,
          tabScope,
          shareCode,
          personTag,
          networkTag,
          workbenchPairing,
          adderKey,
          documentId,
          grantExp,
        },
        crypto.randomUUID(),
      ),
    );
    // Hibernation-aware accept: the runtime owns the socket's event
    // delivery (webSocketMessage / webSocketClose / webSocketError) and
    // may evict this DO between events. NOT ws.accept(), which would pin
    // the DO in memory for the socket's whole life.
    this.state.acceptWebSocket(ws);
  }

  // Read a socket's session attachment (room-session.ts); frames from a null one are dropped.
  private readSession(ws: WebSocket): SessionAttachment | null {
    return readSessionAttachment(ws);
  }

  // Fan an op out to every connected client without a sender. Used
  // for server-originated events (share-link revoked, owner-side
  // forced disconnects). Senders aren't excluded because the
  // originator is the worker itself, not any of the connected peers.
  // Serialize once and send to every connected session (optionally excluding
  // one, e.g. the op's originator). The connected set is the runtime's
  // hibernation-managed list (`state.getWebSockets()`), which drops closed
  // sockets on its own; a send that still throws means a socket that died
  // without the runtime noticing yet, so we just shed its rate entry — the
  // runtime reaps the socket itself.
  // Deliver to the ONE session holding `presenceId`, skipping the sender.
  // Used by the addressed presence ops (the Avatar-mode shove, docs/specs/008-canvas/avatar-mode.md):
  // everyone else has no use for the packet, and fanning it out would leak who
  // is being pushed to the whole room.
  sendToPresence(presenceId: string, payload: ServerMessage, except?: WebSocket): void {
    const serialized = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      const attachment = ws.deserializeAttachment() as SessionAttachment | null;
      if (attachment?.presence?.id !== presenceId) continue;
      const out = this.frameFor(ws, payload, serialized);
      if (out === null) return;
      try {
        ws.send(out);
      } catch {
        this.opRates.delete(ws);
      }
      return;
    }
  }

  broadcast(payload: ServerMessage, except?: WebSocket): void {
    const serialized = JSON.stringify(payload);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      const out = this.frameFor(ws, payload, serialized);
      if (out === null) continue;
      try {
        ws.send(out);
      } catch {
        this.opRates.delete(ws);
      }
    }
  }

  // The frame one socket should receive for `payload`: as serialised for an
  // unscoped session, redacted or withheld (null) for a tab-scoped one
  // (docs/specs/013-workspace/tab-scoped-share-links.md). Only op frames carry tab content.
  private frameFor(ws: WebSocket, payload: ServerMessage, serialized: string): string | null {
    if (payload.kind !== 'op') return serialized;
    const scope = this.scopeOf(ws);
    if (scope === null) return serialized;
    const op = opForScope(payload.op, scope);
    if (op === null) return null;
    return op === payload.op ? serialized : JSON.stringify({ ...payload, op });
  }

  // A socket's tab scope. Read from the attachment, so it survives
  // hibernation; fixed for the life of the session (a rescoped link closes
  // its sessions), so it is read once per socket and kept here: every op
  // frame asks it of every recipient, and a cursor stream in a full room
  // made that a structured-clone read per peer per packet. Lost with the
  // object when the room hibernates, and read again on the next frame.
  private readonly scopes = new WeakMap<WebSocket, string | null>();
  private scopeOf(ws: WebSocket): string | null {
    if (this.scopes.has(ws)) return this.scopes.get(ws) ?? null;
    const scope = this.readSession(ws)?.tabScope ?? null;
    this.scopes.set(ws, scope);
    return scope;
  }

  // After a share-revoked / share-rescoped op has gone out, close every socket
  // its code admitted: its holders must stop receiving ops whether or not
  // their client honours the op (docs/specs/013-workspace/tab-scoped-share-links.md).
  private closeSessionsOfChangedLink(op: unknown): void {
    const { kind, code } = (op ?? {}) as { kind?: unknown; code?: unknown };
    if (typeof kind !== 'string' || !SHARE_LINK_OPS.has(kind) || typeof code !== 'string') return;
    this.closeSockets((ws) =>
      this.readSession(ws)?.shareCode === code ? [SHARE_LINK_CHANGED_CLOSE, kind] : null,
    );
  }

  // Close every socket `pick` gives a close code and reason, shedding each one's rate window.
  // Returns how many it closed.
  private closeSockets(pick: (ws: WebSocket) => [code: number, reason: string] | null): number {
    let closed = 0;
    for (const ws of this.state.getWebSockets()) {
      const close = pick(ws);
      if (!close) continue;
      try {
        ws.close(...close);
      } catch {
        // Already gone.
      }
      this.opRates.delete(ws);
      closed++;
    }
    return closed;
  }

  // Close every session an access change affects (room-access.ts). The editor reloads on the
  // close code, so the next join meets the gates again.
  private closeSessionsForAccessChange(close: AccessCloseMatch): void {
    const code: [number, string] =
      close.match === 'workbench'
        ? [WORKBENCH_ENDED_CLOSE, 'workbench-ended']
        : [ACCESS_CHANGED_CLOSE, 'access-changed'];
    const closed = this.closeSockets((ws) =>
      sessionMatchesAccessClose(this.readSession(ws), close) ? code : null,
    );
    console.info('[room-access] closed', { match: close.match, closed });
  }

  // The document is gone for good: end every session, then drop everything stored here, which includes the
  // collaboration ledger's comment, idea and answer text, the order state, the poll, the baton and the alarm.
  // The ledger's queued writes land first, so none of them can re-create a key after the wipe.
  // That includes the document's content: its SQLite goes with everything else.
  async purge(documentId?: string): Promise<void> {
    if (documentId !== undefined) this.bindDocument(documentId);
    this.closeSockets(() => [DOCUMENT_TRASHED_CLOSE, 'document-purged']);
    this.opLog = [];
    await this.leaveShares();
    await this.leaveCommunity();
    await this.ledger.settled();
    await this.state.storage.deleteAlarm();
    await this.state.storage.deleteAll();
    this.schemaReady = false;
    this.documentRowReady = false;
    this.flushAt = null;
    this.shares.clear();
    this.maintenanceAt = null;
    this.communityAt = null;
    this.head.forget();
    console.info('[room] purged');
  }

  // A canvas going for good takes its Community post with it: the service hears it is gone. Best effort.
  private async leaveCommunity(): Promise<void> {
    const env = this.roomEnv;
    const documentId = this.documentId;
    if (!env || !documentId || !this.hasSchema() || !communityServiceConfigured(env)) return;
    this.ensureSchema();
    if (!(await readCommunityPost(env))) return;
    try {
      await communityService(env, '/sync', {
        method: 'POST',
        body: { documents: [], gone: [documentId] },
      });
    } catch (error) {
      console.warn('[community] gone not sent', { error: String(error) });
    }
  }

  // Ask the index where the Community post's canvas stands, and send the service what changed (community-post.ts).
  private async checkCommunity(now: number): Promise<void> {
    const env = this.roomEnv;
    const documentId = this.documentId;
    this.communityAt = null;
    if (!env || !documentId || !this.hasSchema()) return;
    let post: CommunityPost | null;
    try {
      const meta: DocumentMeta | null = await readDocumentMeta(env, documentId);
      post = await checkCommunityPost(env, documentId, meta, now);
    } catch (error) {
      console.warn('[community] check failed', { error: String(error) });
      post = await readCommunityPost(env);
      if (post) {
        this.communityAt = now + COMMUNITY_CHECK_EVERY_MS;
        return;
      }
    }
    this.communityAt = communityCheckDueAt(post);
  }

  // A document going for good tells the other holders of its shared tabs it left, so their copies stop counting
  // it. Best effort: a holder that misses this hears `gone` the next time it sends here, and drops it then.
  private async leaveShares(): Promise<void> {
    const env = this.roomEnv;
    const documentId = this.documentId;
    const sql = this.state.storage.sql;
    if (!env || !documentId || !sql || !hasDocumentSchema((q) => sql.exec(q))) return;
    this.ensureSchema();
    await documentShares.leaveAll(env, documentId, (to, messages) =>
      documentRoom(env, to).receiveShares(documentId, messages),
    );
  }

  // After a document-trashed op has gone out, close every socket
  // (docs/specs/013-workspace/trash.md): the document is in the Trash, and its
  // admission refuses every new join until it is restored.
  private closeAllIfTrashed(op: unknown): void {
    if ((op as { kind?: unknown } | null)?.kind !== 'document-trashed') return;
    this.closeSockets(() => [DOCUMENT_TRASHED_CLOSE, 'document-trashed']);
  }

  // Put a mutation into the ordered stream: a seq, the catch-up log, every
  // socket but the sender's, and the ledger. One path for a peer's op and for
  // one the worker made (docs/specs/012-collaboration/collab-race-hardening.md), so the two can't drift. Returns the seq.
  private sequenceMutation(from: string, op: unknown, except?: WebSocket): number {
    const seq = ++this.seq;
    this.persistOrder();
    this.opLog.push({ seq, from, op });
    if (this.opLog.length > OP_LOG_LIMIT) this.opLog.shift();
    this.broadcast({ kind: 'op', from, op, seq, epoch: this.epoch }, except);
    this.ledger.record(op, seq);
    return seq;
  }

  broadcastSystemOp(op: unknown): void {
    // System ops broadcast to ALL peers: the originator is the worker itself,
    // not any connected session, so nobody is excluded.
    this.broadcast({ kind: 'op', from: 'system', op });
  }

  // One step on the tab write queue (blueprint SR2), after every step before it. A failed step must not wedge
  // every write after it.
  private queueTabWrite<T>(step: () => Promise<T>): Promise<T> {
    const run = this.tabWriteQueue.then(step);
    this.tabWriteQueue = run.catch(() => undefined);
    return run;
  }

  // One Q&A board write, queued behind every other one for this document
  // (docs/specs/012-collaboration/qa-board.md). Reached only from the api worker's qa route, which has already
  // checked access and derived the actor, so the body is trusted the same way
  // /broadcast's is. The broadcast happens INSIDE the queued step, so peers
  // receive board states in rev order.
  async handleQaWrite(request: Request): Promise<Response> {
    const env = this.roomEnv;
    if (!env) return new Response('no env', { status: 503 });
    let req: QaWriteRequest;
    try {
      req = (await request.json()) as QaWriteRequest;
    } catch {
      return new Response('bad json', { status: 400 });
    }
    const step = this.queueTabWrite(async () => {
      const result = await writeQaAction(env, req);
      if (result.ok && result.changed) {
        this.broadcastOrderedSystemOp({
          kind: 'qa',
          tabId: req.tabId,
          elementId: req.elementId,
          notes: result.notes,
          rev: result.rev,
        });
      }
      return result;
    });
    const result = await step;
    return result.ok
      ? Response.json({ notes: result.notes, rev: result.rev })
      : Response.json({ error: 'qa_write_failed' }, { status: result.status });
  }

  // A system op that changes the document (docs/specs/012-collaboration/qa-board.md): sequenced and logged
  // exactly like a client mutation, so `resolveCatchup` replays it. Nobody is
  // excluded from the relay (there is no sending socket), so there is no
  // separate `cursor` frame to send back either.
  broadcastOrderedSystemOp(op: unknown): void {
    this.sequenceMutation('system', op);
  }

  // Hibernation event handler: one inbound frame from one socket. The DO
  // may have just been re-materialized from cold — everything this needs
  // beyond flood control comes from the socket's attachment.
  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Drop an oversized frame before parsing / broadcasting it: ops are
    // re-broadcast opaquely to every peer, so without a cap one socket
    // could fan a multi-MB payload out to the whole room. Far above any
    // real cursor / select / op frame. Binary frames aren't part of the
    // protocol and parse to nothing.
    const raw = typeof message === 'string' ? message : '';
    if (raw.length > MAX_MESSAGE_CHARS) return;
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    // Per-session frame-rate cap (sliding 1s window). The decision is
    // admitFrame in document-room-rules; this is the socket plumbing.
    const decision = admitFrame(this.opRates.get(ws), Date.now(), OP_RATE_CAP);
    this.opRates.set(ws, decision.rate);
    if (!decision.admit) return;
    const session = this.readSession(ws);
    if (!session) return;
    if (msg.kind === 'grant') {
      this.state.waitUntil(this.renewGrant(ws, (msg as { grant?: unknown }).grant));
      return;
    }
    if (msg.kind === 'hello') {
      // Force the server-resolved role AND the server-assigned ephemeral id
      // onto the stored presence: the hello frame's own `role` / `id` are
      // not trusted. The id override hides the real owner id (docs/specs/015-api/public-api-and-tokens.md §6)
      // and stops a joiner impersonating another peer; the role override is
      // the Viewer / Editor lie-defence. Both come from the attachment, the
      // only per-session store that survives hibernation. Fields are built
      // explicitly (not spread) and length-clamped so a hostile hello can't
      // smuggle arbitrary keys or oversize strings into the attachment —
      // see the size note on SessionAttachment.
      const presence = helloPresence(msg.participant, session);
      ws.serializeAttachment({ ...session, presence } satisfies SessionAttachment);
      // Where the ordered stream stands as this session joins, so a later
      // reconnect asks for what came after it, not for the whole log.
      this.sendTo(ws, { kind: 'cursor', epoch: this.epoch, seq: this.seq });
      // The server's document format number (docs/specs/016-platform/new-version-prompt.md): an editor
      // older than it offers a reload. With the live build id (docs/specs/016-platform/stale-builds.md).
      const build = parseBuildId(this.roomEnv?.BUILD_ID);
      this.sendTo(ws, { kind: 'format', format: DOCUMENT_FORMAT, ...(build ? { build } : {}) });
      // The running poll, and every answer so far (docs/specs/012-collaboration/collab-race-hardening.md).
      for (const op of this.poll.replayOps()) this.sendTo(ws, { kind: 'op', from: 'system', op });
      this.broadcastPresence();
      this.noteMultiplayer();
      this.baton.welcome(ws, session, presence.id, msg.facilitatorToken);
      return;
    }
    if (msg.kind === 'facilitator') {
      this.baton.handle(msg, session);
      return;
    }
    if (msg.kind === 'sync') {
      // A (re)connecting client asks what it missed (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1).
      // Answer from the in-memory op log or tell it to re-hydrate. Costs
      // no state change, so it's allowed from any connected session
      // (a view-only peer needs to catch up too).
      this.sendCatchup(ws, msg.epoch, typeof msg.lastSeq === 'number' ? msg.lastSeq : 0);
      return;
    }
    if (msg.kind === 'op') {
      const sender = session.presence;
      if (!sender) return;
      // The role gate (room-op-gate.ts): what this session may relay, by its server-verified role.
      const gate = gateClientOp(msg.op, {
        role: sender.role,
        tabScope: session.tabScope ?? null,
        key: sender.key,
      });
      if (gate.kind === 'drop') return;
      if (gate.kind === 'participant-content') {
        void this.participantWrites.applyContentOp(
          {
            ws,
            presenceId: sender.id,
            documentId: session.documentId ?? null,
            adderKey: session.adderKey ?? null,
          },
          msg.op,
          msg.ref,
        );
        return;
      }
      // An Editor's element op the validator refuses goes nowhere; its sender alone hears why
      // (docs/specs/012-collaboration/realtime-conflict-resolution.md "An invalid element").
      if (!gate.presence && this.refusesElementOp(ws, msg)) return;
      if (gate.participantAnswers) {
        this.participantWrites.scheduleAnswers(
          session.documentId ?? null,
          (msg.op as { tabId?: unknown }).tabId,
        );
      }
      const opKind = (msg.op as { kind?: unknown } | null | undefined)?.kind;
      const isPresenceOp = gate.presence;
      // Running the session belongs to whoever holds the baton (docs/specs/012-collaboration/facilitator.md).
      // Only these two ops can be enforced here: a poll start / end is its own
      // kind, while the timer and the dot vote ride the same `tab` /
      // `tab-meta` ops as every shape move, so telling them apart would mean
      // inspecting payloads for no gain against somebody who can already save
      // the whole document over REST. Those stay a client-side rule, which is
      // what docs/specs/012-collaboration/facilitator.md says out loud: who is driving, not who is allowed.
      if (opKind === 'poll-start' || opKind === 'poll-end') {
        if (!this.baton.mayRun(sender.id)) return;
      }
      // Remember the sender's current tab so a future joiner learns it
      // from the presence list (tab-focus ops only fire on a switch, so
      // they're invisible to anyone who joins afterwards). Persisted to
      // the attachment — in-memory-only would forget everyone's tab on
      // the next hibernation and mis-place peers for every later joiner.
      // The live relay below still drives real-time updates for peers
      // already connected.
      // Every selection is noted for the api's held check, whatever the role
      // (docs/specs/024-agents/agent-changesets.md "Held elements"). The DO's output gate holds
      // what follows until the write lands.
      if (opKind === 'select') {
        void this.selections.note(sender.id, selectionFromOp(msg.op)).catch(() => {});
      }
      if (opKind === 'tab-focus') {
        const { tabId, besideTabId } = msg.op as { tabId?: unknown; besideTabId?: unknown };
        if (typeof tabId === 'string') {
          sender.tabId = tabId.slice(0, MAX_TAB_ID_LEN);
          // The other pane of a side by side split (docs/specs/007-editor/split-view.md "Presence"),
          // clamped like tabId; anything but a string clears it. A tab-scoped session has one tab
          // and no split, so it never holds one.
          if (typeof besideTabId === 'string' && !session.tabScope)
            sender.besideTabId = besideTabId.slice(0, MAX_TAB_ID_LEN);
          else delete sender.besideTabId;
          ws.serializeAttachment({ ...session, presence: sender } satisfies SessionAttachment);
        }
      }
      // A follow is the room's to keep, never relayed: it tells the people followed, on their own sockets.
      if (opKind === 'follow') {
        this.noteFollow(ws, session, sender, msg.op);
        return;
      }
      // Presence ops relay unordered (ephemeral, no catch-up). Mutation
      // ops get a monotonic seq within the epoch and land in the catch-up
      // log so a reconnecting peer can replay the delta (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1).
      if (isPresenceOp) {
        // A shove (docs/specs/008-canvas/avatar-mode.md) is ADDRESSED, not broadcast: it asks one peer to
        // step aside, and only the room knows which socket that is. Presence
        // ids are server-minted precisely so a client never learns another
        // peer's real owner id (docs/specs/015-api/public-api-and-tokens.md §6) — which also means a receiver can't
        // recognise its own id in the packet. So the routing happens here, and
        // a client acts on any avatar-push that reaches it.
        // The room decides who an answer belongs to, and relays only what it accepted, under the key it chose
        // (docs/specs/012-collaboration/vote-integrity.md): the sender's proof never leaves the room.
        // Chained, so answers apply in the order they arrived even though each one is hashed first: a quick change
        // of mind must not lose to the answer it replaced.
        if (opKind === 'poll-answer') {
          const op = msg.op;
          this.pollAnswers = this.pollAnswers
            .then(() => this.relayPollAnswer(ws, op))
            .catch(() => {});
          return;
        }
        if (opKind === 'avatar-push') {
          const targetId = (msg.op as { targetId?: unknown }).targetId;
          if (typeof targetId === 'string') {
            this.sendToPresence(targetId, { kind: 'op', from: sender.id, op: msg.op }, ws);
          }
          return;
        }
        this.broadcast({ kind: 'op', from: sender.id, op: msg.op }, ws);
      } else {
        // No comment author id leaves the room, whatever a client sent: it is
        // the author's owner id, a guest's credential. And a posted comment
        // carries the name of the session that sent it, the one on its
        // cursor, not whatever the frame claimed (docs/specs/012-collaboration/collab-race-hardening.md).
        // A scoped session's whole-tab op goes out under the stored name: it may not rename its tab
        // (docs/specs/013-workspace/tab-scoped-share-links.md "No rename from a scoped session").
        const scoped = scopedTabOp(msg.op, session.tabScope ?? null, (tabId) =>
          this.storedTabName(tabId),
        );
        const op = stampCommentAuthor(opForTheWire(scoped), sender);
        const seq = this.sequenceMutation(sender.id, op, ws);
        // The relay skips the sender, so tell it the seq its op took: its own
        // ops are already applied, and a reconnect must not replay them. The
        // op's `ref` comes back with it, so a save waiting on this op knows the
        // ledger has it (docs/specs/012-collaboration/collab-race-hardening.md phase 6).
        const ref = isRoomOpRef(msg.ref) ? { ref: msg.ref } : {};
        this.sendTo(ws, { kind: 'cursor', epoch: this.epoch, seq, ...ref });
        if (opKind === 'poll-start' || opKind === 'poll-end') this.poll.noteLifecycle(op);
      }
    }
  }

  // Answer a client's `sync` (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): given the last epoch+seq it
  // applied, either replay the ops it missed or tell it to re-hydrate.
  //
  //   - Same epoch, caught up (lastSeq >= seq) → empty delta.
  //   - Same epoch, within the log window → replay ops after lastSeq.
  //   - Same epoch but behind the trimmed log floor → resync (we no longer
  //     hold the ops it missed).
  //   - Fresh client (no epoch, lastSeq 0) → replay the whole current log;
  //     element ops apply idempotently by id, so re-applying ops the client
  //     already has from its D1 hydrate is harmless.
  //   - Any other epoch mismatch with prior progress → resync: the client
  //     saw a previous room instance and we can't map its seq onto ours.
  private sendCatchup(ws: WebSocket, epoch: string | null, lastSeq: number): void {
    const { ops, resync } = resolveCatchup(
      { epoch, lastSeq },
      { epoch: this.epoch, seq: this.seq, opLog: this.opLog },
    );
    // A tab-scoped session replays its own tab only, like the live relay.
    const scope = this.scopeOf(ws);
    const visible =
      scope === null
        ? ops
        : ops.flatMap((o) => {
            const op = opForScope(o.op, scope);
            return op === null ? [] : [{ ...o, op }];
          });
    const payload: ServerMessage = {
      kind: 'catchup',
      epoch: this.epoch,
      seq: this.seq,
      ops: visible,
      resync,
    };
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      this.opRates.delete(ws);
    }
  }

  // The element gate (@liveworkspace/api-kit/room-element-ops, docs/specs/015-api/blueprints/room-element-ops.md):
  // one per room instance, so its bounded log is per room. Answers a refused op to its sender alone.
  private readonly elementGate = createRoomElementGate(ROOM_ELEMENT_RULES);
  private refusesElementOp(ws: WebSocket, msg: { op: unknown; ref?: unknown }): boolean {
    const refused = this.elementGate(msg.op, msg.ref);
    if (refused) this.sendTo(ws, refused);
    return refused !== null;
  }

  /** Deliver one frame to one socket. */
  private sendTo(ws: WebSocket, payload: ServerMessage): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      this.opRates.delete(ws);
    }
  }

  // One live poll answer (docs/specs/012-collaboration/vote-integrity.md). The poll decides the key from what the
  // room holds about this session, and the room relays only an accepted answer, as the poll rewrote it.
  private async relayPollAnswer(ws: WebSocket, op: unknown): Promise<void> {
    const session = this.readSession(ws);
    const sender = session?.presence;
    if (!session || !sender) return;
    const outcome = await this.poll.noteAnswer(op, {
      presenceId: sender.id,
      personTag: session.personTag ?? null,
      networkTag: session.networkTag ?? null,
      answeredAs: () => this.readSession(ws)?.pollAnsweredAs ?? null,
      rememberAnswer: (answeredAs) => {
        const latest = this.readSession(ws);
        if (latest) ws.serializeAttachment({ ...latest, pollAnsweredAs: answeredAs });
      },
    });
    if (!outcome.accepted) {
      // A stale or malformed answer is routine; a refusal is the interesting one. Never the key or the proof.
      if (outcome.reason !== 'no_poll' && outcome.reason !== 'bad_value') {
        console.warn('[live-poll] answer refused', { reason: outcome.reason });
      }
      return;
    }
    this.broadcast({ kind: 'op', from: sender.id, op: outcome.op }, ws);
  }

  // Who this session follows (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"): kept on the
  // session, then the person it stopped following and the one it now follows each hear their new list.
  private noteFollow(
    ws: WebSocket,
    session: SessionAttachment,
    sender: ParticipantPresence,
    op: unknown,
  ): void {
    const target = followTargetOf(op, sender.id);
    const before = session.following ?? null;
    if (before === target) return;
    const { following: _drop, ...rest } = session;
    ws.serializeAttachment({
      ...rest,
      presence: sender,
      ...(target ? { following: target } : {}),
    } satisfies SessionAttachment);
    if (before) this.sendFollowers(before);
    if (target) this.sendFollowers(target);
  }

  // Tell `target` who follows them, on their socket alone; `except` is a socket on its way out.
  private sendFollowers(target: string, except?: WebSocket): void {
    const sessions = this.state
      .getWebSockets()
      .filter((s) => s !== except)
      .map((s) => this.readSession(s))
      .map((s) => ({ presenceId: s?.presence?.id, following: s?.following }));
    this.sendToPresence(
      target,
      { kind: 'followers', ids: followerIdsOf(sessions, target) },
      except,
    );
  }

  /** The one connected socket wearing this presence id. */
  private socketByPresence(presenceId: string): WebSocket | null {
    for (const ws of this.state.getWebSockets()) {
      if (this.readSession(ws)?.presence?.id === presenceId) return ws;
    }
    return null;
  }

  // The room's one alarm, at the earliest of: the facilitator grace deadline, an agent presence expiry
  // (agent-presence I5, PR29), a session's grant to ask for or lapse, the outbox's next push, the next send to a
  // shared tab's holders, the Community post's next check, the document's next upkeep. None when nothing is due.
  private armAlarm(): void {
    const due = [
      this.baton.deadline() ?? null,
      this.agents.nextExpiry(),
      this.nextGrantDue(),
      this.flushAt,
      this.shares.at,
      this.communityAt,
      this.maintenanceAt,
    ].filter((t): t is number => t !== null);
    if (due.length === 0) void this.state.storage.deleteAlarm();
    else void this.state.storage.setAlarm(Math.min(...due));
  }

  /**
   * Agent entries past their expiry go; then the grace clock ran out (or did not, if they came back); the outbox
   * pushes and the upkeep runs when due. Safe to call early.
   */
  override async alarm(): Promise<void> {
    const expired = await this.agents.sweep();
    for (const r of expired) agentPresenceLog('expired', r);
    if (expired.length > 0) this.broadcastPresence();
    this.baton.alarm();
    const now = Date.now();
    this.checkGrants(now);
    if (this.flushAt !== null && this.flushAt <= now) await this.drainIndex();
    // A shared tab written while the push was in flight (its write armed nothing then).
    this.shares.noteWrite();
    if (this.shares.due(now)) await this.drainShares();
    if (this.communityAt !== null && this.communityAt <= now) await this.checkCommunity(now);
    if (this.maintenanceAt !== null && this.maintenanceAt <= now) await this.maintain(now);
    this.armAlarm();
  }

  // Internal: an agent presence write from the worker (room-agent-presence.ts). Same trust argument as /broadcast.
  private async handleAgentPresence(request: Request, url: URL): Promise<Response> {
    const res = await answerAgentPresence(this.agents, request, url, () =>
      this.broadcastPresence(),
    );
    this.armAlarm();
    return res;
  }

  // A trashed document or a changed link clears agent entries (room-agent-presence.ts, PR15).
  private async clearAgentsFor(op: unknown): Promise<void> {
    await clearAgentsForOp(this.agents, op, () => this.broadcastPresence(), 'document-trashed');
    this.armAlarm();
  }

  // Hibernation event handlers for a session ending. The runtime removes
  // the socket from getWebSockets() itself; our job is only to shed the
  // rate window (so the map can't leak) and re-announce the roster.
  override webSocketClose(ws: WebSocket): void {
    this.dropSession(ws);
  }

  override webSocketError(ws: WebSocket): void {
    this.dropSession(ws);
  }

  private dropSession(ws: WebSocket): void {
    this.opRates.delete(ws);
    const leaving = this.readSession(ws);
    // A follower leaving is one fewer for the person they followed.
    if (leaving?.following) this.sendFollowers(leaving.following, ws);
    const presenceId = leaving?.presence?.id;
    if (presenceId) {
      this.baton.startGrace(presenceId);
      void this.selections.drop(presenceId).catch(() => {});
    }
    // Exclude the departing socket explicitly: depending on when the
    // runtime prunes it from getWebSockets(), it could otherwise still
    // appear in the roster of this very broadcast.
    this.broadcastPresence(ws);
  }

  // The person tags of the hello'd sessions: who is looking at the canvas now, whom a phone notification skips
  // (docs/specs/014-identity/phone-notifications.md).
  private roomPeople(): Set<string> {
    const tags = new Set<string>();
    for (const session of this.liveSessions().values())
      if (session.personTag) tags.add(session.personTag);
    return tags;
  }

  // Every hello'd session with a live socket, by presence id: what the selection store answers
  // against, so an entry whose socket is gone never holds anything.
  private liveSessions(): Map<string, LiveSession> {
    const live = new Map<string, LiveSession>();
    for (const ws of this.state.getWebSockets()) {
      const session = this.readSession(ws);
      const p = session?.presence;
      if (!p) continue;
      live.set(p.id, { name: p.name, color: p.color, personTag: session.personTag ?? null });
    }
    return live;
  }

  // Count the room's multiplayer session once, from the one place that sees
  // every participant (docs/specs/017-telemetry/telemetry.md). Runs after each hello, the only moment the
  // hello'd roster can grow; the decision and its session rule live in
  // room-multiplayer.ts.
  private noteMultiplayer(): void {
    const sockets = this.state.getWebSockets();
    const sessions = sockets.map((ws) => this.readSession(ws));
    const decision = multiplayerDecision(
      sessions.map((s) => ({ present: Boolean(s?.presence), multiplayer: s?.multiplayer })),
    );
    for (const i of decision.mark) {
      const session = sessions[i];
      if (!session) continue;
      try {
        sockets[i]!.serializeAttachment({
          ...session,
          multiplayer: true,
        } satisfies SessionAttachment);
      } catch {
        // A socket that died mid-loop: the runtime reaps it, nothing to mark.
      }
    }
    const env = this.roomEnv;
    if (decision.report && env) {
      const write = reportServerEvent(env, 'Document', 'Used', 'Multiplayer');
      // Keep the DO alive until the row lands; the write swallows its own error.
      this.state.waitUntil(write);
    }
  }

  // Send each client the roster minus its own entry (room-roster.ts).
  broadcastPresence(except?: WebSocket): void {
    const entries: RosterEntry[] = [];
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      const session = this.readSession(ws);
      entries.push({
        ws,
        presence: session?.presence ?? null,
        personTag: session?.personTag ?? null,
        account: session?.account === true,
      });
    }
    // Agent entries past their expiry never reach a frame; the store drops them on its next sweep (PR30).
    const now = Date.now();
    const agentEntries = this.agents.live().filter((r) => r.expiresAt > now);
    if (agentEntries.length < this.agents.live().length)
      void this.agents.sweep().then(() => this.armAlarm());
    for (const { ws, participants, agents } of rosterFrames(entries, agentEntries)) {
      try {
        ws.send(JSON.stringify({ kind: 'presence', participants, agents } satisfies ServerMessage));
      } catch {
        // Dead socket: the runtime reaps it from getWebSockets(); we only
        // shed the in-memory rate entry so the map can't leak.
        this.opRates.delete(ws);
      }
    }
  }
}
