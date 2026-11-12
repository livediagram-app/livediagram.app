import { type ItemHeadSync, sharesDueAt, ShareSchedule } from '@liveworkspace/index-app';
import { DurableObject } from 'cloudflare:workers';
import {
  BELL_THROTTLE_MS,
  createKnockThrottle,
  createNudgeLedger,
  ROOM_PING,
  ROOM_PONG,
  type AccessLevel,
} from '@livehuddle/api-schema';
import { RoomParticipantWrites } from '../room-participant';
import { RoomLedgerStore } from '@liveworkspace/api-kit/room-ledger-store';
import {
  ledgerKey,
  ledgerPrefix,
  recordInLedger,
  tabLedgerFrom,
  type TabLedger,
} from '@livehuddle/document';
import { RoomSelectionStore } from '../room-selections';
import { agentPresenceLog, RoomAgentPresence } from '@liveworkspace/api-kit/room-agent-presence';
import type { DocumentEnv, Env, ServerMessage } from '../types';
import type { LoggedOp } from '../document-room-rules';
import { ROOM_ELEMENT_RULES } from '../room-element-rules';
import { createRoomElementGate } from '@liveworkspace/api-kit/room-element-ops';
import type { InternalRoom } from '../room-internal';
import type { FacilitatorState } from '../facilitator';
import { RoomFacilitator } from '../room-facilitator';
import {
  newSessionAttachment,
  readSessionAttachment,
  type SessionAttachment,
} from '../room-session';
import type { CommunityAuthor } from '@livehuddle/api-schema';
import { documentHasTab } from '../db/tabs';
import { callsMode } from '../calls/calls-mode';
import { CallsModeWatch } from '../calls/calls-mode-watch';
import { RoomCalls, type HearingAnswer, type HearingAsk } from '../calls/room-calls';
import {
  ItemDb,
  type ExportCommentsResult,
  type ExportQuery,
  type ExportResult,
} from '@liveworkspace/index-app';
import { hasDocumentSchema } from './document-schema';
import {
  importDocumentCopy,
  readDocumentOutline,
  type DocumentCopy,
  type DocumentOutline,
} from './document-content';
import { PresenceRelay, RELAYED_SAMPLE_KINDS } from '@liveworkspace/api-kit/room-presence-relay';
import { createAvatarTrack, type AvatarRelaySession } from '../room-avatar-track';
import { exportDocumentFile, importDocumentFile, type DocumentFileImport } from './document-file';
import type { ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import { exportDocumentComments } from './document-comments';
import { importMigratedDocument } from './document-migration';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import {
  documentShares,
  type ShareAnswer,
  type ShareMessage,
  type SharedTabCopy,
} from './tab-shares';
import type { RouteIdentity } from './document-route';
import {
  drainIndex,
  drainShares,
  ensureSchema,
  localNamespace,
  MAINTENANCE_KEY,
  noteWrite,
  restoreContentState,
  roomHeadSync,
} from './room-content-state';
import * as rpc from './room-rpc';
import { community, communityListing, communityPostTitle } from './room-community';
import { renewGrant, roomFetch } from './room-grants';
import {
  broadcast,
  closeAllIfTrashed,
  closeSessionsForAccessChange,
  closeSessionsOfChangedLink,
  closeSockets,
  frameFor,
  relaySessionOf,
  sendToPresence,
  turnAwayIfFull,
} from './room-sockets';
import { alarm, armAlarm, purge } from './room-lifecycle';
import { sweepStaleAttendance } from './room-attendance';
import { roomMessage } from './room-message';
import { callSessions, storedTabRev } from './room-call-sessions';
import {
  broadcastPresence,
  clearAgentsFor,
  dropSession,
  handleAgentPresence,
  liveSessions,
  noteMultiplayer,
  roomPeople,
  socketByPresence,
} from './room-roster';

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
//     authors, and keeps collaboration state (the ledger, the facilitator baton). Payloads stay
//     `op: unknown` so the editor can evolve its vocabulary without changing the room. Two edits to the same
//     element are last-writer-wins in room order.
//
// The class holds the room's state and its doors; what each door does lives beside it, in functions that take the
// room: room-content-state.ts (schema, outbox, upkeep), room-rpc.ts and room-community.ts (the worker's calls),
// room-grants.ts (the upgrade and grants), room-sockets.ts (fan-out and closes), room-message.ts (inbound frames),
// room-call-sessions.ts (calls, nudges), room-roster.ts (presence) and room-lifecycle.ts (alarm, purge). So the
// members those functions read are not `private`.
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

// How long the outbox waits after a write before it pushes, the least gap between two pushes, and the retry after a
// failed one: @liveworkspace/index-app's (outbox.ts), the same for every app's items.
export { FLUSH_IDLE_MS, FLUSH_MIN_GAP_MS } from '@liveworkspace/index-app';
// The document's own daily upkeep (room-content-state.ts).
export { MAINTENANCE_EVERY_MS } from './room-content-state';

// The sample streams this room relays and coalesces (docs/specs/015-api/api.md "A busy room bounds its presence
// fan-out"): the cursors (the walking characters join as their own track, ../room-avatar-track.ts), plus proximity
// audio's talking level (docs/specs/012-collaboration/proximity-audio.md "The wire"), so a full Space talking adds
// bytes to frames the walkers already cause, never frames; and a game's paddle (docs/specs/009-elements/social-pieces.md "The wire"),
// which only its tab can see.
const ROOM_SAMPLE_KINDS: ReadonlySet<string> = new Set([
  ...RELAYED_SAMPLE_KINDS,
  'avatar-voice',
  'game-input',
]);

// The collaboration ledger: this product's pure module (collab-ledger.ts) on the shared store
// (liveworkspace/docs/specs/002-architecture/architecture.md "A room's collaboration ledger").
type LedgerEntry = NonNullable<Parameters<typeof recordInLedger>[0]>;
const LEDGER_RULES = { ledgerKey, ledgerPrefix, recordInLedger, tabLedgerFrom };

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
  baton: RoomFacilitator;
  get facilitator(): FacilitatorState {
    return this.baton.state;
  }
  // The collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3); see room-ledger-store.
  ledger: RoomLedgerStore<LedgerEntry, TabLedger>;
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
  documentId: string | null = null;
  schemaReady = false;
  documentRowReady = false;
  // The outbox's next push (null: nothing pending), the last one, and whether one is running now.
  flushAt: number | null = null;
  lastFlushAt = 0;
  draining = false;
  // The next send to the other holders of its shared tabs (tab-shares.ts): on idle, not held to the outbox's
  // once a minute, since it is a call to another document rather than a push.
  readonly shares = new ShareSchedule(() =>
    this.schemaReady ? sharesDueAt(this.state.storage.sql) : null,
  );
  // The next daily upkeep (persisted, so a wake keeps the day).
  maintenanceAt: number | null = null;
  // Content writes so far (noteWrite), so route() can tell a request that wrote from one that didn't.
  writes = 0;
  // The canvas's Community post as last read (null: none), and when it next asks where it stands.
  communityAt: number | null = null;
  // The canvas's owner and team, kept from every grant the room is handed (a socket's ticket, a renewal, an API
  // request's grant), so a guest's merge into an account or a move to another team reaches the canvas's emails,
  // pushes and alarm (@liveworkspace/index-app item-head.ts). Made by room-content-state.ts roomHeadSync.
  readonly head: ItemHeadSync;

  // The tab write queue (blueprint SR2): a Participant's writes, one at a time per document. A Durable Object only
  // serialises the synchronous parts of its handlers: while one write is awaiting its store, the runtime happily
  // starts the next request, and two read-modify-writes of the same row would be exactly the race that once cost the
  // retired dot vote its votes. In memory because a queue only matters while requests are in flight; a hibernation wake has
  // none.
  private tabWriteQueue: Promise<unknown> = Promise.resolve();
  // The surface the api worker's internal endpoints act on (room-internal.ts).
  readonly internal: InternalRoom;
  // A Participant's content and answers (docs/specs/013-workspace/share-roles.md), see room-participant.ts.
  participantWrites: RoomParticipantWrites;

  // A socket's tab scope. Read from the attachment, so it survives
  // hibernation; fixed for the life of the session (a rescoped link closes
  // its sessions), so it is read once per socket and kept here: every op
  // frame asks it of every recipient, and a cursor stream in a full room
  // made that a structured-clone read per peer per packet. Lost with the
  // object when the room hibernates, and read again on the next frame.
  readonly scopes = new WeakMap<WebSocket, string | null>();
  // The calls kill switch, read while a call is under way here (docs/specs/016-platform/calls-kill-switch.md "The
  // room tells its clients"): every socket hears when it changes.
  readonly callsWatch = new CallsModeWatch({
    read: () => callsMode(this.roomEnv ?? {}),
    tell: (mode) =>
      this.broadcast({ kind: 'op', from: 'system', op: { kind: 'calls-mode', mode } }),
  });
  // Who may hear whom, and who may let a hand speak, as the server sees it (docs/specs/012-collaboration/
  // meeting-rooms-and-stage.md "Trust"; calls/room-calls.ts): what the mint route asks before a subscription.
  // Knocks pass one per sender per window (docs/specs/012-collaboration/knock.md "The wire"): memory only.
  readonly knocks = createKnockThrottle();
  // Rings of a Reception Desk's bell pass one per sender per 5 seconds (docs/specs/009-elements/workday-pieces.md "The
  // wire"), the knock's throttle with its own window: memory only.
  readonly bells = createKnockThrottle(BELL_THROTTLE_MS);
  // Nudges pass once per 2 minutes per sender and target (docs/specs/012-collaboration/nudge.md "The wire"): memory
  // only, keyed by stable identity so a second tab or a reconnect does not reopen the window.
  readonly nudges = createNudgeLedger();
  readonly calls = new RoomCalls({
    now: () => Date.now(),
    sessions: () => callSessions(this),
    readTab: (tabId, knownRev) => storedTabRev(this, tabId, knownRev),
  });
  // The sample streams, walking characters and cursors (docs/specs/015-api/api.md "A busy room bounds its
  // presence fan-out"): sent to a character's tab only, and coalesced per socket in a busy room.
  readonly presenceRelay = new PresenceRelay<WebSocket, AvatarRelaySession>({
    sockets: () => this.state.getWebSockets(),
    sessionOf: (ws) => relaySessionOf(this.readSession(ws)),
    frameFor: (ws, payload, serialized) => frameFor(this, ws, payload, serialized),
    send: (ws, frame) => {
      try {
        ws.send(frame);
      } catch {
        this.opRates.delete(ws);
      }
    },
    schedule: (fn, ms) => void setTimeout(fn, ms),
    sampleKinds: ROOM_SAMPLE_KINDS,
    tracks: { avatar: createAvatarTrack() },
  });
  // The element gate (@liveworkspace/api-kit/room-element-ops, docs/specs/015-api/blueprints/room-element-ops.md):
  // one per room instance, so its bounded log is per room. Answers a refused op to its sender alone.
  readonly elementGate = createRoomElementGate(ROOM_ELEMENT_RULES);

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
          DOCUMENT_ROOM: localNamespace(this, env.DOCUMENT_ROOM),
          ROOM_PEOPLE: () => roomPeople(this),
        }
      : undefined;
    this.ledger = new RoomLedgerStore(state.storage, LEDGER_RULES);
    this.head = roomHeadSync(this);
    this.participantWrites = new RoomParticipantWrites({
      env: this.roomEnv,
      enqueue: (step) => this.queueTabWrite(step),
      sequence: (from, op, except) => this.sequenceMutation(from, op, except),
      sendTo: (ws, payload) => this.sendTo(ws, payload),
      position: () => ({ epoch: this.epoch, seq: this.seq }),
      readLedger: (tabId) => this.ledger.read(tabId),
    });
    this.internal = {
      broadcastSystemOp: (op) => this.broadcastSystemOp(op),
      closeSessionsOfChangedLink: (op) => this.closeSessionsOfChangedLink(op),
      closeAllIfTrashed: (op) => closeAllIfTrashed(this, op),
      clearAgentsFor: (op) => this.clearAgentsFor(op),
      closeSessionsForAccessChange: (close) => closeSessionsForAccessChange(this, close),
      purge: () => this.purge(),
      handleAgentPresence: (req, u) => handleAgentPresence(this, req, u),
      sequenceMutation: (from, op) => this.sequenceMutation(from, op),
      readSelections: (tabId, person) => this.selections.read(tabId, liveSessions(this), person),
      readLedger: (tabId, since) => this.ledger.read(tabId, since),
      epoch: () => this.epoch,
    };
    this.baton = new RoomFacilitator({
      storage: state.storage,
      broadcast: (payload, except) => this.broadcast(payload, except),
      sendTo: (ws, payload) => this.sendTo(ws, payload),
      sendToPresence: (presenceId, payload) => this.sendToPresence(presenceId, payload),
      socketByPresence: (presenceId) => socketByPresence(this, presenceId),
      readSession: (ws) => this.readSession(ws),
      armAlarm: () => this.armAlarm(),
    });
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
      for (const r of await this.agents.restore()) agentPresenceLog('expired', r);
      restoreContentState(this, await state.storage.get<number>(MAINTENANCE_KEY));
      // Visits a restart left open (room-attendance.ts): only when the room starts with nobody connected.
      sweepStaleAttendance(this);
      this.armAlarm();
    });
  }

  // ---------- The document's content (room-content-state.ts) ----------------------------------------------------

  hasSchema(): boolean {
    const sql = this.state.storage.sql;
    return this.schemaReady || (!!sql && hasDocumentSchema((q) => sql.exec(q)));
  }

  // Every call names its document; an object answers for one document only.
  bindDocument(documentId: string): void {
    if (this.documentId === null) this.documentId = documentId;
    else if (this.documentId !== documentId)
      throw new Error('document id does not match this object');
  }

  ensureSchema(): void {
    ensureSchema(this);
  }

  noteWrite(): void {
    noteWrite(this);
  }

  // Push what the outbox holds to the index and the media service, and send what the shared tabs' holders are owed,
  // now. A failure keeps it and retries later.
  async drain(): Promise<void> {
    await drainIndex(this);
    await drainShares(this);
  }

  // ---------- RPC: what the worker asks of a document (document-client.ts, room-rpc.ts) ---------------------------

  async outline(documentId: string): Promise<DocumentOutline> {
    this.bindDocument(documentId);
    return readDocumentOutline(this.requireEnv(), documentId);
  }

  route(documentId: string, request: Request, identity: RouteIdentity): Promise<Response> {
    return rpc.route(this, documentId, request, identity);
  }

  // The canvas's Community post (room-community.ts).
  community(documentId?: string): Promise<{ code: string; open: boolean } | null> {
    return community(this, documentId);
  }

  communityListing(
    documentId: string,
    code: string,
  ): Promise<{ postId: string; author: CommunityAuthor } | null> {
    return communityListing(this, documentId, code);
  }

  communityPostTitle(documentId: string, code: string): Promise<string | null> {
    return communityPostTitle(this, documentId, code);
  }

  takeHead(grant: { owner?: string | null; team: string | null }): Promise<void> {
    return rpc.takeHead(this, grant);
  }

  exportImage(documentId: string, query: ExportQuery): Promise<ExportResult> {
    return rpc.exportImage(this, documentId, query);
  }

  // The export door's `file` format (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps", document-file.ts): the
  // canvas's whole envelope, its last save as the version, unread when the caller holds that save.
  async exportFile(documentId: string, query: ExportQuery): Promise<ExportResult> {
    this.bindDocument(documentId);
    if (!this.hasSchema()) return { status: 'not_found' };
    return exportDocumentFile(this.requireEnv(), documentId, query.ifVersion);
  }

  // The export door's `comments` format (liveworkspace/docs/specs/003-accounts/data-export.md "The apps' doors",
  // document-comments.ts): every thread in the Space with its real authors, for the data export. A Space never
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

  addConnectedTab(documentId: string, write: ConnectedTabWrite): Promise<ConnectedTabOutcome> {
    return rpc.addConnectedTab(this, documentId, write);
  }

  async hasTab(documentId: string, tabId: string): Promise<boolean> {
    this.bindDocument(documentId);
    return documentHasTab(this.requireEnv(), documentId, tabId);
  }

  servesImage(documentId: string, imageId: string, onlyTabId: string | null): Promise<boolean> {
    return rpc.servesImage(this, documentId, imageId, onlyTabId);
  }

  exportCopy(
    documentId: string,
    onlyTabId: string | null,
    copier: { by: string | null; code: string | null } | null,
  ): Promise<{ copy: DocumentCopy; community: boolean } | null> {
    return rpc.exportCopy(this, documentId, onlyTabId, copier);
  }

  async importCopy(documentId: string, copy: DocumentCopy): Promise<void> {
    this.bindDocument(documentId);
    await importDocumentCopy(this.requireEnv(), documentId, copy);
  }

  // An old livehuddle.app document's part (the migration door, document-migration.ts): one transaction, with its
  // own times; the outbox pushes it to the index and the media service as any write.
  async importMigrated(
    documentId: string,
    payload: MigrationRoomPayload,
  ): Promise<MigrationDoorAnswer> {
    this.bindDocument(documentId);
    this.requireEnv();
    return importMigratedDocument(this.db, payload);
  }

  revokeCodes(
    documentId: string,
    codes: string[],
    reason: 'revoked' | 'rescoped' = 'revoked',
  ): Promise<number> {
    return rpc.revokeCodes(this, documentId, codes, reason);
  }

  joined(documentId: string, personId: string): Promise<void> {
    return rpc.joined(this, documentId, personId);
  }

  anonymise(documentId: string, personId: string): Promise<number> {
    return rpc.anonymise(this, documentId, personId);
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

  receiveShares(
    documentId: string,
    from: string,
    messages: ShareMessage[],
  ): Promise<ShareAnswer[]> {
    return rpc.receiveShares(this, documentId, from, messages);
  }

  requireEnv(): DocumentEnv {
    if (!this.roomEnv) throw new Error('document room has no env');
    return this.roomEnv;
  }

  // Record the seq we just handed out. Not awaited: the DO output gate holds
  // outbound messages until pending writes land, so a peer can never see an
  // op whose seq failed to persist.
  private persistOrder(): void {
    void this.state.storage.put(ORDER_STATE_KEY, { epoch: this.epoch, seq: this.seq });
  }

  // ---------- Sessions: the upgrade, grants and fan-out (room-grants.ts, room-sockets.ts) --------------------------

  override fetch(input: Request | string, init?: RequestInit): Promise<Response> {
    return roomFetch(this, input, init);
  }

  renewGrant(ws: WebSocket, ticket: unknown): Promise<void> {
    return renewGrant(this, ws, ticket);
  }

  turnAwayIfFull(server: WebSocket): boolean {
    return turnAwayIfFull(this, server);
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
    adderKey: string | null = null,
    documentId: string | null = null,
    grantExp: number | null = null,
    // The session's collab key (X-Verified-Collab-Key, docs/specs/013-workspace/share-roles.md "The collab key"):
    // none mints one for this socket.
    collabKey: string | null = null,
    // The person stamped on its reactions (X-Verified-Reaction-Person,
    // docs/specs/012-collaboration/comment-reactions.md).
    reactionPerson: string | null = null,
  ): void {
    ws.serializeAttachment(
      newSessionAttachment(
        {
          verifiedRole,
          collabKey,
          reactionPerson,
          isOwner,
          tabScope,
          shareCode,
          personTag,
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
  readSession(ws: WebSocket): SessionAttachment | null {
    return readSessionAttachment(ws);
  }

  sendToPresence(presenceId: string, payload: ServerMessage, except?: WebSocket): void {
    sendToPresence(this, presenceId, payload, except);
  }

  broadcast(payload: ServerMessage, except?: WebSocket): void {
    broadcast(this, payload, except);
  }

  closeSessionsOfChangedLink(op: unknown): void {
    closeSessionsOfChangedLink(this, op);
  }

  closeSockets(pick: (ws: WebSocket) => [code: number, reason: string] | null): number {
    return closeSockets(this, pick);
  }

  purge(documentId?: string): Promise<void> {
    return purge(this, documentId);
  }

  // Put a mutation into the ordered stream: a seq, the catch-up log, every
  // socket but the sender's, and the ledger. One path for a peer's op and for
  // one the worker made (docs/specs/012-collaboration/collab-race-hardening.md), so the two can't drift. Returns the seq.
  sequenceMutation(from: string, op: unknown, except?: WebSocket): number {
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
  queueTabWrite<T>(step: () => Promise<T>): Promise<T> {
    const run = this.tabWriteQueue.then(step);
    this.tabWriteQueue = run.catch(() => undefined);
    return run;
  }

  // ---------- Hibernation events, the alarm and presence (room-message.ts, room-lifecycle.ts, room-roster.ts) -----

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    roomMessage(this, ws, message);
  }

  /** Deliver one frame to one socket. */
  sendTo(ws: WebSocket, payload: ServerMessage): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      this.opRates.delete(ws);
    }
  }

  armAlarm(): void {
    armAlarm(this);
  }

  override alarm(): Promise<void> {
    return alarm(this);
  }

  clearAgentsFor(op: unknown): Promise<void> {
    return clearAgentsFor(this, op);
  }

  // Hibernation event handlers for a session ending. The runtime removes
  // the socket from getWebSockets() itself; our job is only to shed the
  // rate window (so the map can't leak) and re-announce the roster.
  override webSocketClose(ws: WebSocket): void {
    dropSession(this, ws);
  }

  override webSocketError(ws: WebSocket): void {
    dropSession(this, ws);
  }

  // The mint route's question (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Trust", #483): may this call
  // session receive these tracks now? One answer per track.
  async callsHearing(
    documentId: string,
    subscriberSession: string,
    asks: HearingAsk[],
  ): Promise<HearingAnswer[]> {
    this.bindDocument(documentId);
    return this.calls.hearing(subscriberSession, asks);
  }

  noteMultiplayer(): void {
    noteMultiplayer(this);
  }

  broadcastPresence(except?: WebSocket): void {
    broadcastPresence(this, except);
  }
}
