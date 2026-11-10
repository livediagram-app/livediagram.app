import { ItemDb, type ItemHeadSync, sharesDueAt, ShareSchedule } from '@liveworkspace/index-app';
import { DurableObject } from 'cloudflare:workers';
import { grantOwnImages } from '../db/image-grants';
import { ROOM_PING, ROOM_PONG, type AccessLevel } from '@livedesign/api-schema';
import { RoomParticipantWrites } from '../room-participant';
import { RoomLedgerStore } from '@liveworkspace/api-kit/room-ledger-store';
import {
  ledgerKey,
  ledgerPrefix,
  recordInLedger,
  tabLedgerFrom,
  type TabLedger,
} from '@livedesign/design';
import { RoomSelectionStore } from '../room-selections';
import { agentPresenceLog, RoomAgentPresence } from '@liveworkspace/api-kit/room-agent-presence';
import { armRoomAlarm } from '@liveworkspace/api-kit/room-alarm';
import type { Env, DesignEnv, ServerMessage } from '../types';
import { type LoggedOp } from '../design-room-rules';
import { ROOM_ELEMENT_RULES } from '../room-element-rules';
import { createRoomElementGate } from '@liveworkspace/api-kit/room-element-ops';
import { answerInternal, type InternalRoom } from '../room-internal';
import { readSessionAttachment, verifiedSessionOf, type SessionAttachment } from '../room-session';
import { designHasTab } from '../db/tabs';
import { PHOTO_ADOPT_MAX_IDS } from '@livedesign/photo-engine';
import { heldBlobs, type PhotoBlobMeta } from '../db/photo-blobs';
import type { ExportCommentsResult, ExportQuery, ExportResult } from '@liveworkspace/index-app';
import {
  designShares,
  type ShareAnswer,
  type ShareMessage,
  type SharedTabCopy,
} from './tab-shares';
import { hasDesignSchema } from './design-schema';
import {
  importDesignCopy,
  readDesignOutline,
  type DesignCopy,
  type DesignOutline,
} from './design-content';
import type { CommunityListing, CopySource } from '../design-client';
import type { Copier } from '@liveworkspace/index-app';
import { importDesignFile, type DesignFileImport } from './design-file';
import type { ConnectedTabOutcome } from '@liveworkspace/index-app';
import type { ConnectedTabWrite } from '@liveworkspace/index-client';
import { importMigratedDesign } from './design-migration';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import { type RouteIdentity } from './design-route';
import {
  MAINTENANCE_KEY,
  restoreContentState,
  ensureSchema,
  noteWrite,
  drain,
  drainShares,
  drainIndex,
  maintain,
  checkCommunity,
  purge,
} from './design-room-content';
import {
  route,
  communityOf,
  communityListing,
  communityPostTitle,
  exportImage,
  exportFile,
  exportComments,
  addConnectedTab,
  servesImage,
  exportCopy,
  revokeCodes,
  joined,
  anonymise,
  receiveShares,
} from './design-room-doors';
import { nextGrantDue, checkGrants, renewGrant, acceptSession } from './design-room-grants';
import {
  ORDER_STATE_KEY,
  sendToPresence,
  broadcast,
  broadcastSystemOp,
} from './design-room-sockets';
import { webSocketMessage } from './design-room-frames';
import {
  localNamespace,
  roomHead,
  roomParticipantWrites,
  roomInternal,
} from './design-room-wiring';
import { dropSession, roomPeople, broadcastPresence } from './design-room-presence';

// One SQLite-backed Durable Object per design id (docs/specs/015-api/api.md "Storage" and "Realtime model"). It is
// two things at once:
//
//   - The design's content: tabs (with their stats), image references and grants, photo blob
//     refs and the changeset log, in its own SQLite (design-schema.ts), which the content modules reach as
//     `env.DESIGN_DB` (index-app item-db.ts). Every API request about the design runs here (`route`,
//     design-route.ts), so a save is one call to this object and one SQLite transaction. What the index's cross-design reads need (the
//     Inbox, the listing summary, the Timeline) and the media service's references are pushed from the outbox on
//     idle (design-outbox.ts).
//   - The realtime room: connected WebSockets and their identity, presence, and the ordered op stream. It
//     classifies each op by kind, orders mutations (seq within an epoch, kept in storage), rewrites comment
//     authors, and keeps collaboration state (the ledger). Payloads stay `op: unknown` so the editor can evolve
//     its vocabulary without changing the room. Two edits to the same element are last-writer-wins in room order.
//
// Duration cost: the object is billed while it runs a request or an alarm, not while sockets idle (hibernation,
// below). Content requests and preview drawings now run here rather than in the worker, so a design with heavy
// API traffic keeps its object awake for that traffic; an idle design costs nothing.
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

// How long the outbox waits after a write before it pushes, the least gap between two pushes, and the retry after a
// failed one: @liveworkspace/index-app's (outbox.ts), the same for every app's items.
export { FLUSH_IDLE_MS, FLUSH_MIN_GAP_MS } from '@liveworkspace/index-app';
export { MAINTENANCE_EVERY_MS } from './design-room-content';

// The collaboration ledger: this product's pure module (collab-ledger.ts) on the shared store
// (liveworkspace/docs/specs/002-architecture/architecture.md "A room's collaboration ledger").
type LedgerEntry = NonNullable<Parameters<typeof recordInLedger>[0]>;
const LEDGER_RULES = { ledgerKey, ledgerPrefix, recordInLedger, tabLedgerFrom };

export class DesignRoom extends DurableObject<Env> {
  // What the sibling modules (design-room-*.ts) act on is public to them; nothing outside this folder reaches in.
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
  // The collaboration ledger (docs/specs/012-collaboration/collab-race-hardening.md phase 3); see room-ledger-store.
  ledger: RoomLedgerStore<LedgerEntry, TabLedger>;
  // Each session's selection, for the api's held check (room-selections.ts).
  selections: RoomSelectionStore;
  // Agent presence entries (docs/specs/024-agents/agent-presence.md "Presence").
  agents: RoomAgentPresence;

  // The env the design's code runs with here: the worker's bindings, its own SQLite as `DESIGN_DB`, and a
  // DESIGN_ROOM that answers this design's own id with this object (no hop). Undefined only for a unit test that
  // builds a room from a fake state alone; then the content and telemetry paths are skipped.
  roomEnv: DesignEnv | undefined;
  // The design's SQLite behind the D1 surface (@liveworkspace/index-app item-db.ts).
  readonly db: ItemDb;
  // The design this object is, from the first call that names it (every RPC and room join does).
  designId: string | null = null;
  schemaReady = false;
  designRowReady = false;
  // The outbox's next push (null: nothing pending), the last one, and whether one is running now.
  flushAt: number | null = null;
  // The next send to the other holders of its shared tabs (tab-shares.ts): on idle, not held to the outbox's once a
  // minute, since it is a call to another design rather than a push.
  readonly shares = new ShareSchedule(() =>
    this.schemaReady ? sharesDueAt(this.state.storage.sql) : null,
  );
  lastFlushAt = 0;
  draining = false;
  // Content writes so far (noteWrite), so route() can tell a request that wrote from one that didn't.
  writes = 0;
  // The next daily upkeep (persisted, so a wake keeps the day).
  maintenanceAt: number | null = null;
  // When the design's Community post next asks where it stands (null: no post).
  communityAt: number | null = null;

  // The tab write queue. Every write this room makes to this design's tabs
  // runs through here ONE AT A TIME. A Durable Object only serialises the
  // synchronous parts of its handlers: while one write is awaiting D1, the
  // runtime happily starts the next request, and two read-modify-writes of the
  // same row would be exactly the race that loses one of the two writes.
  // In memory because a queue only matters while requests are in flight; a
  // hibernation wake has none.
  // Blueprint SR2: a Participant's writes, one at a time per design.
  private tabWriteQueue: Promise<unknown> = Promise.resolve();
  // The surface the api worker's internal endpoints act on (room-internal.ts).
  private readonly internal: InternalRoom;
  // A Participant's content and answers (docs/specs/013-workspace/share-roles.md), see room-participant.ts.
  participantWrites: RoomParticipantWrites;
  // The design's owner and team, kept from every grant the room is handed (a socket's ticket, a renewal, an API
  // request's grant), so a guest's merge into an account or a move to another team reaches the design's emails,
  // pushes and alarm (@liveworkspace/index-app item-head.ts).
  readonly head: ItemHeadSync;
  // The element gate (@liveworkspace/api-kit/room-element-ops, docs/specs/015-api/blueprints/room-element-ops.md):
  // one per room instance, so its bounded log is per room. Answers a refused op to its sender alone.
  readonly elementGate = createRoomElementGate(ROOM_ELEMENT_RULES);
  // A socket's tab scope. Read from the attachment, so it survives
  // hibernation; fixed for the life of the session (a rescoped link closes
  // its sessions), so it is read once per socket and kept here: every op
  // frame asks it of every recipient, and a cursor stream in a full room
  // made that a structured-clone read per peer per packet. Lost with the
  // object when the room hibernates, and read again on the next frame.
  readonly scopes = new WeakMap<WebSocket, string | null>();

  constructor(state: DurableObjectState, env?: Env) {
    super(state, env as Env);
    this.state = state;
    this.db = new ItemDb(state.storage.sql, {
      transaction: (fn) => state.storage.transactionSync(fn),
      ensureSchema: () => ensureSchema(this),
      onWrite: () => noteWrite(this),
    });
    this.roomEnv = env
      ? {
          ...env,
          DESIGN_DB: this.db.asD1(),
          DESIGN_ROOM: localNamespace(this, env.DESIGN_ROOM),
          ROOM_PEOPLE: () => roomPeople(this),
        }
      : undefined;
    this.ledger = new RoomLedgerStore(state.storage, LEDGER_RULES);
    this.head = roomHead(this);
    this.participantWrites = roomParticipantWrites(this);
    this.internal = roomInternal(this);
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
        // First instantiation for this design: adopt the random epoch above.
        await state.storage.put(ORDER_STATE_KEY, { epoch: this.epoch, seq: this.seq });
      }
      for (const r of await this.agents.restore()) agentPresenceLog('expired', r);
      restoreContentState(this, await state.storage.get<number>(MAINTENANCE_KEY));
      this.armAlarm();
    });
  }

  // ---------- The design's content --------------------------------------------------------------------------

  // Every call names its design; an object answers for one design only.
  bindDesign(designId: string): void {
    if (this.designId === null) this.designId = designId;
    else if (this.designId !== designId) throw new Error('design id does not match this object');
  }

  drain(): Promise<void> {
    return drain(this);
  }

  // ---------- RPC: what the worker asks of a design (design-client.ts) -------------------------------------------

  async outline(designId: string): Promise<DesignOutline> {
    this.bindDesign(designId);
    return readDesignOutline(this.requireEnv(), designId);
  }

  route(designId: string, request: Request, identity: RouteIdentity): Promise<Response> {
    return route(this, designId, request, identity);
  }

  // The design's Community post's link as the doors read it: its code, and whether it opens the design now
  // (community-post.ts openCommunityCode). Null for a design with no post.
  async community(designId: string): Promise<{ code: string; open: boolean } | null> {
    this.bindDesign(designId);
    return communityOf(this, designId);
  }

  communityListing(designId: string, code: string): Promise<CommunityListing | null> {
    return communityListing(this, designId, code);
  }

  communityPostTitle(designId: string, code: string): Promise<string | null> {
    return communityPostTitle(this, designId, code);
  }

  // Whether this object's SQLite holds a design schema: an id nothing has written answers no post.
  storedSchema(): boolean {
    const sql = this.state.storage.sql;
    return this.schemaReady || (!!sql && hasDesignSchema((q) => sql.exec(q)));
  }

  exportImage(designId: string, query: ExportQuery): Promise<ExportResult> {
    return exportImage(this, designId, query);
  }

  exportFile(designId: string, query: ExportQuery): Promise<ExportResult> {
    return exportFile(this, designId, query);
  }

  exportComments(designId: string): Promise<ExportCommentsResult> {
    return exportComments(this, designId);
  }

  // A new design from a Drive file (routes/internal-file.ts read it): its tabs land as a copy's do, and it starts as
  // its owner's.
  async importFile(designId: string, file: DesignFileImport): Promise<void> {
    this.bindDesign(designId);
    await importDesignFile(this.requireEnv(), designId, file);
  }

  addConnectedTab(designId: string, write: ConnectedTabWrite): Promise<ConnectedTabOutcome> {
    return addConnectedTab(this, designId, write);
  }

  async hasTab(designId: string, tabId: string): Promise<boolean> {
    this.bindDesign(designId);
    return designHasTab(this.requireEnv(), designId, tabId);
  }

  servesImage(designId: string, imageId: string, onlyTabId: string | null): Promise<boolean> {
    return servesImage(this, designId, imageId, onlyTabId);
  }

  // A Participant's placement claim (routes/images.ts checked the caller may add to the design): the images of `ids`
  // that `personId` uploaded are granted here (db/image-grants.ts grantOwnImages). Answers how many.
  async grantOwnImages(designId: string, ids: string[], personId: string): Promise<number> {
    this.bindDesign(designId);
    return grantOwnImages(this.requireEnv(), ids, personId, Date.now());
  }

  async heldBlobs(designId: string, tabId: string, ids: string[]): Promise<PhotoBlobMeta[]> {
    this.bindDesign(designId);
    return heldBlobs(this.requireEnv(), tabId, ids.slice(0, PHOTO_ADOPT_MAX_IDS));
  }

  exportCopy(
    designId: string,
    onlyTabId: string | null,
    copier: Copier | null,
  ): Promise<CopySource | null> {
    return exportCopy(this, designId, onlyTabId, copier);
  }

  async importCopy(designId: string, copy: DesignCopy): Promise<void> {
    this.bindDesign(designId);
    await importDesignCopy(this.requireEnv(), designId, copy);
  }

  // An old livediagram.app document's livedesign part (the migration door, design-migration.ts): one transaction,
  // with its own times; the outbox pushes it to the index and the media service as any write.
  async importMigrated(
    designId: string,
    payload: MigrationRoomPayload,
  ): Promise<MigrationDoorAnswer> {
    this.bindDesign(designId);
    this.requireEnv();
    return importMigratedDesign(this.db, payload);
  }

  revokeCodes(
    designId: string,
    codes: string[],
    reason: 'revoked' | 'rescoped' = 'revoked',
  ): Promise<number> {
    return revokeCodes(this, designId, codes, reason);
  }

  joined(designId: string, personId: string): Promise<void> {
    return joined(this, designId, personId);
  }

  anonymise(designId: string, personId: string): Promise<number> {
    return anonymise(this, designId, personId);
  }

  // Take the owner and team a grant names as the design's own copy. A failure is logged, never the caller's: the
  // next grant tries again.
  async takeHead(grant: { owner?: string | null; team: string | null }): Promise<void> {
    if (!this.roomEnv) return;
    try {
      await this.head.sync(grant);
    } catch (err) {
      console.warn('[room] owner and team not taken from the grant', { error: String(err) });
    }
  }

  // ---------- RPC: a tab shared with other designs (tab-shares.ts) --------------------------------------------

  // A design joining this tab's holders: the tab as held here and who holds it.
  async sharedTabCopy(designId: string, tabId: string): Promise<SharedTabCopy | null> {
    this.bindDesign(designId);
    return designShares.copyOf(this.requireEnv(), designId, tabId);
  }

  // `member` now holds the tab too.
  async shareJoined(
    designId: string,
    tabId: string,
    member: string,
    seenUpdatedAt: number,
  ): Promise<boolean> {
    this.bindDesign(designId);
    return designShares.recordJoin(this.requireEnv(), designId, tabId, member, seenUpdatedAt);
  }

  receiveShares(designId: string, from: string, messages: ShareMessage[]): Promise<ShareAnswer[]> {
    return receiveShares(this, designId, from, messages);
  }

  requireEnv(): DesignEnv {
    if (!this.roomEnv) throw new Error('design room has no env');
    return this.roomEnv;
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
    // Server-resolved facts (set by the api worker before forwarding the upgrade): room-session.ts.
    const v = verifiedSessionOf(request);
    this.acceptSession(
      server,
      v.verifiedRole,
      v.tabScope,
      v.shareCode,
      v.personTag,
      v.workbenchPairing,
      v.adderKey,
      v.designId,
      v.grantExp ?? null,
    );
    if (v.designId) {
      this.bindDesign(v.designId);
      if (v.head) await this.takeHead(v.head);
    }
    this.armAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  renewGrant(ws: WebSocket, ticket: unknown): Promise<void> {
    return renewGrant(this, ws, ticket);
  }

  acceptSession(
    ws: WebSocket,
    verifiedRole?: AccessLevel,
    tabScope: string | null = null,
    shareCode: string | null = null,
    personTag: string | null = null,
    workbenchPairing: string | null = null,
    adderKey: string | null = null,
    designId: string | null = null,
    grantExp: number | null = null,
  ): void {
    acceptSession(
      this,
      ws,
      verifiedRole,
      tabScope,
      shareCode,
      personTag,
      workbenchPairing,
      adderKey,
      designId,
      grantExp,
    );
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

  purge(designId?: string): Promise<void> {
    return purge(this, designId);
  }

  broadcastSystemOp(op: unknown): void {
    broadcastSystemOp(this, op);
  }

  // One step on the tab write queue (blueprint SR2), after every step before it. A failed step must not wedge
  // every write after it.
  queueTabWrite<T>(step: () => Promise<T>): Promise<T> {
    const run = this.tabWriteQueue.then(step);
    this.tabWriteQueue = run.catch(() => undefined);
    return run;
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    webSocketMessage(this, ws, message);
  }

  // The room's one alarm, at the earliest of: an agent presence expiry (agent-presence I5, PR29), the outbox's
  // next push, the Community post's next check, the design's next upkeep. None when nothing is due.
  armAlarm(): void {
    const due = [
      this.agents.nextExpiry(),
      this.flushAt,
      this.shares.at,
      this.communityAt,
      this.maintenanceAt,
      nextGrantDue(this),
    ];
    // Never sooner than a second from now, and no write when it already stands there (api-kit room-alarm.ts).
    armRoomAlarm(this.state.storage, due, Date.now());
  }

  /** Agent entries past their expiry go; the outbox pushes and the upkeep runs when due. Safe to call early. */
  override async alarm(): Promise<void> {
    const expired = await this.agents.sweep();
    for (const r of expired) agentPresenceLog('expired', r);
    if (expired.length > 0) this.broadcastPresence();
    const now = Date.now();
    checkGrants(this, now);
    if (this.flushAt !== null && this.flushAt <= now) await drainIndex(this);
    // A shared tab written while the push was in flight (its write armed nothing then).
    this.shares.noteWrite();
    if (this.shares.due(now)) await drainShares(this);
    if (this.communityAt !== null && this.communityAt <= now) await checkCommunity(this, now);
    if (this.maintenanceAt !== null && this.maintenanceAt <= now) await maintain(this, now);
    this.armAlarm();
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

  broadcastPresence(except?: WebSocket): void {
    broadcastPresence(this, except);
  }
}
