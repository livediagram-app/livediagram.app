import {
  createItemHeadSync,
  earliestRoomGrantDue,
  FLUSH_IDLE_MS,
  FLUSH_RETRY_MS,
  ItemDb,
  type ItemHeadSync,
  nextFlushAt,
  renewRoomGrant,
  roomGrantStep,
  recordItemEditor,
  owesShares,
  ShareSchedule,
} from '@liveworkspace/index-app';
import { indexService } from '../index-service';
import { DurableObject } from 'cloudflare:workers';
import { designServesImage } from '../db/image-grants';
import {
  ACCESS_CHANGED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_FULL_CLOSE,
  ROOM_FULL_REASON,
  ROOM_GRANT_ASK_BEFORE_MS,
  roomIsFull,
  WORKBENCH_ENDED_CLOSE,
  DESIGN_FORMAT,
  DESIGN_TRASHED_CLOSE,
  isRoomOpRef,
  levelAtLeast,
  parseBuildId,
  parseStoredLevel,
  ROOM_PING,
  ROOM_PONG,
  type AccessLevel,
} from '@livedesign/api-schema';
import { opForTheWire, stampCommentAuthor } from '@livedesign/design';
import { RoomParticipantWrites } from '../room-participant';
import { RoomLedgerStore } from '../room-ledger-store';
import { RoomSelectionStore, selectionFromOp, type LiveSession } from '../room-selections';
import {
  agentPresenceLog,
  answerAgentPresence,
  clearAgentsForOp,
  RoomAgentPresence,
} from '@liveworkspace/api-kit/room-agent-presence';
import type { ClientMessage, Env, DesignEnv, ParticipantPresence, ServerMessage } from '../types';
import { reportServerEvent } from '../server-telemetry';
import { multiplayerDecision } from '@liveworkspace/api-kit/room-multiplayer';
import {
  type LoggedOp,
  MAX_TAB_ID_LEN,
  admitFrame,
  helloPresence,
  resolveCatchup,
} from '../design-room-rules';
import { followerIdsOf, followTargetOf } from '@liveworkspace/api-kit/room-follows';
import { opForScope, opFromScopedSender } from '../room-scope';
import { gateClientOp } from '../room-op-gate';
import { ROOM_ELEMENT_RULES } from '../room-element-rules';
import { createRoomElementGate } from '@liveworkspace/api-kit/room-element-ops';
import { answerInternal, type InternalRoom } from '../room-internal';
import { rosterFrames, type RosterEntry } from '../room-roster';
import {
  sessionMatchesAccessClose,
  type AccessCloseMatch,
} from '@liveworkspace/api-kit/room-access';
import {
  newSessionAttachment,
  readSessionAttachment,
  verifiedSessionOf,
  type SessionAttachment,
} from '../room-session';

import { CHANGESET_RETENTION_MS } from '@livedesign/api-schema';
import { deleteOldChangesets } from '../db/changesets';
import { designHasTab } from '../db/tabs';
import { PHOTO_ADOPT_MAX_IDS } from '@livedesign/photo-engine';
import {
  designBlobIds,
  heldBlobs,
  releaseBlobs,
  sweepDesignPhotoBlobs,
  type PhotoBlobMeta,
} from '../db/photo-blobs';
import { forgetDesignMediaRefs } from '../media';
import { drawDesign } from '../thumbnail';
import type { ExportQuery, ExportResult } from '@liveworkspace/index-app';
import {
  designShares,
  type ShareAnswer,
  type ShareMessage,
  type SharedTabCopy,
} from './tab-shares';
import { designRoom } from '../design-client';
import { hasDesignSchema, migrateDesignSchema } from './design-schema';
import {
  exportDesignCopy,
  importDesignCopy,
  readDesignMeta,
  readDesignHead,
  readDesignOutline,
  type DesignCopy,
  type DesignOutline,
} from './design-content';
import {
  checkCommunityPost,
  COMMUNITY_CHECK_MS,
  communityCheckDueAt,
  communityPostAuthor,
  leaveCommunity,
  openCommunityCode,
  readCommunityPost,
  type CommunityPost,
} from './community-post';
import type { CommunityListing, CopySource } from '../design-client';
import type { Copier } from '@liveworkspace/index-app';
import { notifyDesignJoin } from '../email/notifications';
import { anonymiseDesign } from './design-anonymise';
import { DESIGN_OUTBOX, drainOutbox } from './design-outbox';
import { exportDesignFile, importDesignFile, type DesignFileImport } from './design-file';
import { importMigratedDesign } from './design-migration';
import type { MigrationDoorAnswer, MigrationRoomPayload } from '@liveworkspace/migration';
import { answerDesignRequest, isDesignCreate, type RouteIdentity } from './design-route';

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
// note on SessionAttachment). MAX_TAB_ID_LEN comes from ./design-room-rules,
// which owns the clamp it applies to a hello frame's tabId.

// How many recent mutation ops the room keeps for reconnect catch-up
// (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1). A reconnecting client within this many ops of the
// live tail replays the delta; further behind, it re-hydrates from D1.
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
// The design's own daily upkeep: unnamed photo blobs go, old changesets go.
export const MAINTENANCE_EVERY_MS = 24 * 60 * 60 * 1000;
const MAINTENANCE_KEY = 'maintenance-at';

export class DesignRoom extends DurableObject<Env> {
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
  ledger: RoomLedgerStore;
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
  private designId: string | null = null;
  private schemaReady = false;
  private designRowReady = false;
  // The outbox's next push (null: nothing pending), the last one, and whether one is running now.
  private flushAt: number | null = null;
  // The next send to the other holders of its shared tabs (tab-shares.ts): on idle, not held to the outbox's once a
  // minute, since it is a call to another design rather than a push.
  private readonly shares = new ShareSchedule(
    () => this.schemaReady && owesShares(this.state.storage.sql),
  );
  private lastFlushAt = 0;
  private draining = false;
  // Content writes so far (noteWrite), so route() can tell a request that wrote from one that didn't.
  private writes = 0;
  // The next daily upkeep (persisted, so a wake keeps the day).
  private maintenanceAt: number | null = null;
  // When the design's Community post next asks where it stands (null: no post).
  private communityAt: number | null = null;

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
  private participantWrites: RoomParticipantWrites;
  // The design's owner and team, kept from every grant the room is handed (a socket's ticket, a renewal, an API
  // request's grant), so a guest's merge into an account or a move to another team reaches the design's emails,
  // pushes and alarm (@liveworkspace/index-app item-head.ts).
  private readonly head: ItemHeadSync;

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
          DESIGN_DB: this.db.asD1(),
          DESIGN_ROOM: this.localNamespace(env.DESIGN_ROOM),
          ROOM_PEOPLE: () => this.roomPeople(),
        }
      : undefined;
    this.ledger = new RoomLedgerStore(state.storage);
    this.head = createItemHeadSync({
      read: async () => {
        if (this.designId === null) return null;
        this.ensureSchema();
        const row = state.storage.sql
          .exec<{ owner_id: string | null; team_id: string | null }>(
            'SELECT owner_id, team_id FROM design WHERE id = ? AND created_at > 0',
            this.designId,
          )
          .toArray()[0];
        return row ? { ownerId: row.owner_id ?? '', teamId: row.team_id ?? null } : null;
      },
      write: async (h) => {
        state.storage.sql.exec(
          'UPDATE design SET owner_id = ?, team_id = ? WHERE id = ?',
          h.ownerId,
          h.teamId,
          this.designId,
        );
        console.info('[room] owner or team taken from the grant', { team: h.teamId !== null });
        this.noteWrite();
        // A new owner or team can open or close a Community post: it asks where it stands now.
        if (this.communityAt !== null) this.communityAt = Date.now();
      },
    });
    this.participantWrites = new RoomParticipantWrites({
      env: this.roomEnv,
      enqueue: (step) => this.queueTabWrite(step),
      sequence: (from, op, except) => this.sequenceMutation(from, op, except),
      sendTo: (ws, payload) => this.sendTo(ws, payload),
      position: () => ({ epoch: this.epoch, seq: this.seq }),
    });
    this.internal = {
      broadcastSystemOp: (op) => this.broadcastSystemOp(op),
      closeSessionsOfChangedLink: (op) => this.closeSessionsOfChangedLink(op),
      closeAllIfTrashed: (op) => this.closeAllIfTrashed(op),
      clearAgentsFor: (op) => this.clearAgentsFor(op),
      closeSessionsForAccessChange: (close) => this.closeSessionsForAccessChange(close),
      purge: () => this.purge(),
      handleAgentPresence: (req, u) => this.handleAgentPresence(req, u),
      sequenceMutation: (from, op) => this.sequenceMutation(from, op),
      readSelections: (tabId, person) => this.selections.read(tabId, this.liveSessions(), person),
      readLedger: (tabId) => this.ledger.read(tabId),
      epoch: () => this.epoch,
    };
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
      this.restoreContentState(await state.storage.get<number>(MAINTENANCE_KEY));
      this.armAlarm();
    });
  }

  // ---------- The design's content --------------------------------------------------------------------------

  // After a wake: the design id and anything the outbox still owes the index and the media service. Reads only; a design with no schema yet
  // (an id nothing has written) stays without one.
  private restoreContentState(maintenanceAt: number | undefined): void {
    this.maintenanceAt = maintenanceAt ?? null;
    const sql = this.state.storage.sql;
    if (!sql || !hasDesignSchema((q) => sql.exec(q))) return;
    this.ensureSchema();
    const row = sql.exec('SELECT id FROM design LIMIT 1').toArray()[0];
    if (typeof row?.id === 'string' && this.designId === null) this.designId = row.id;
    if (sql.exec('SELECT 1 FROM outbox LIMIT 1').toArray().length > 0) this.flushAt = Date.now();
    this.shares.restore();
    // The Community post's next check (community-post.ts), from when it last asked.
    const post = sql
      .exec<{ checked_at: number }>('SELECT checked_at FROM community_post LIMIT 1')
      .toArray()[0];
    this.communityAt = post ? post.checked_at + COMMUNITY_CHECK_MS : null;
  }

  // Every call names its design; an object answers for one design only.
  private bindDesign(designId: string): void {
    if (this.designId === null) this.designId = designId;
    else if (this.designId !== designId) throw new Error('design id does not match this object');
  }

  // The schema on first use (design-schema.ts), and the design's row once its id is known, so the content's
  // foreign keys always find it. A row made here has no dates (0): a create or a copy sets them, and the
  // summary push never moves saved_at back.
  private ensureSchema(): void {
    if (this.schemaReady && (this.designRowReady || this.designId === null)) return;
    const sql = this.state.storage.sql;
    if (!this.schemaReady) {
      migrateDesignSchema((q) => sql.exec(q));
      this.schemaReady = true;
    }
    if (this.designId !== null && !this.designRowReady) {
      sql.exec(
        'INSERT OR IGNORE INTO design (id, saved_at, created_at) VALUES (?, 0, 0)',
        this.designId,
      );
      this.designRowReady = true;
    }
  }

  // A content write happened: push to the index and the media service on idle, at most once a minute (design-outbox.ts). Writes the drain
  // itself makes (its outbox delete) schedule nothing.
  private noteWrite(): void {
    if (this.draining) return;
    this.writes++;
    if (this.maintenanceAt === null) {
      this.maintenanceAt = Date.now() + MAINTENANCE_EVERY_MS;
      void this.state.storage.put(MAINTENANCE_KEY, this.maintenanceAt);
      this.armAlarm();
    }
    // A shared tab's holders get their copy on idle (tab-shares.ts).
    if (this.shares.noteWrite()) this.armAlarm();
    if (this.flushAt !== null) return;
    if (this.state.storage.sql.exec('SELECT 1 FROM outbox LIMIT 1').toArray().length === 0) return;
    const now = Date.now();
    this.flushAt = nextFlushAt(now, this.lastFlushAt);
    this.armAlarm();
  }

  // Push what the outbox holds to the index and the media service now. A failure keeps it and retries later.
  // Push what the outbox holds now, and send what the shared tabs' holders are owed. A failure keeps it and retries
  // later.
  async drain(): Promise<void> {
    await this.drainIndex();
    await this.drainShares();
  }

  // Send the other holders of its shared tabs what they are owed (tab-shares.ts). A failure keeps it for later.
  private async drainShares(): Promise<void> {
    const env = this.roomEnv;
    const designId = this.designId;
    if (!env || !designId || !this.schemaReady) {
      this.shares.clear();
      return;
    }
    this.draining = true;
    try {
      const done = await this.shares.send(() =>
        designShares.drain(env, designId, (to, messages) =>
          designRoom(env, to).receiveShares(designId, messages),
        ),
      );
      if (done && done.sent > 0) console.debug('[tab-shares] sent', { designId, sent: done.sent });
    } finally {
      this.draining = false;
    }
  }

  private async drainIndex(): Promise<void> {
    const env = this.roomEnv;
    const designId = this.designId;
    this.flushAt = null;
    if (!env || !designId || !this.schemaReady) return;
    this.draining = true;
    try {
      const { keys, pushes, more } = await drainOutbox(env, designId);
      this.lastFlushAt = Date.now();
      if (keys > 0) console.debug('[design-outbox] pushed', { designId, keys, pushes });
      // A big import's tabs go a batch at a time, back to back, not a minute apart.
      if (more) this.flushAt = Date.now() + FLUSH_IDLE_MS;
    } catch (error) {
      console.warn('[design-outbox] push failed', { designId, error: String(error) });
      this.flushAt = Date.now() + FLUSH_RETRY_MS;
    } finally {
      this.draining = false;
    }
    // Anything written while the push was in flight goes next time.
    if (
      this.flushAt === null &&
      this.state.storage.sql.exec('SELECT 1 FROM outbox LIMIT 1').toArray().length > 0
    ) {
      this.flushAt = nextFlushAt(Date.now(), this.lastFlushAt);
    }
  }

  // The design's daily upkeep, once a day per design with content: photo blob refs its tabs no longer name go,
  // and the blobs it no longer holds are released (db/photo-blobs.ts); changesets past their retention go (CS28).
  private async maintain(now: number): Promise<void> {
    const env = this.roomEnv;
    const designId = this.designId;
    this.maintenanceAt = now + MAINTENANCE_EVERY_MS;
    await this.state.storage.put(MAINTENANCE_KEY, this.maintenanceAt);
    if (!env || !designId || !this.schemaReady) return;
    try {
      const photos = await sweepDesignPhotoBlobs(env, designId, now);
      if (photos.refs > 0) console.info('[photo-blobs] sweep', { designId, ...photos });
      const gone = await deleteOldChangesets(env, now - CHANGESET_RETENTION_MS);
      if (gone > 0) console.info('[changeset] retention', { designId, deleted: gone });
    } catch (error) {
      console.warn('[design-room] upkeep failed', { designId, error: String(error) });
    }
  }

  // This env's DESIGN_ROOM, answering this design's own id with this object: the code shared with the worker (a
  // design read's outline, the room relays) then calls straight in rather than through a stub.
  private localNamespace(
    real: DurableObjectNamespace<DesignRoom> | undefined,
  ): DurableObjectNamespace<DesignRoom> {
    const ns = (real ?? {}) as DurableObjectNamespace<DesignRoom>;
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

  // ---------- RPC: what the worker asks of a design (design-client.ts) -------------------------------------------

  async outline(designId: string): Promise<DesignOutline> {
    this.bindDesign(designId);
    return readDesignOutline(this.requireEnv(), designId);
  }

  async route(designId: string, request: Request, identity: RouteIdentity): Promise<Response> {
    this.bindDesign(designId);
    const env = this.requireEnv();
    // Before the write counter is read: taking the owner and team is no edit.
    if (identity.grant?.item === designId) await this.takeHead(identity.grant);
    const community = await this.communityOf(designId);
    const writesBefore = this.writes;
    const response = await answerDesignRequest(
      env,
      request,
      identity,
      (p) => this.state.waitUntil(p),
      community,
    );
    // A request that wrote is an edit by whoever asked: their Timeline entry and a Most Used day
    // (@liveworkspace/index-app recordItemEditor). Reads, refusals and requests that changed nothing are not, nor is
    // the create, the design's making (isDesignCreate).
    if (response.ok && identity.owner && this.writes > writesBefore) {
      if (!isDesignCreate(request)) {
        const sql = this.state.storage.sql;
        recordItemEditor(
          (q, ...b) => sql.exec(q, ...b),
          DESIGN_OUTBOX,
          designId,
          identity.owner,
          Date.now(),
        );
      }
      this.noteWrite();
    }
    // A post published or removed by this request starts or stops its checks.
    if (request.method !== 'GET' && new URL(request.url).pathname.endsWith('/community')) {
      this.communityAt = communityCheckDueAt(await readCommunityPost(env));
      this.armAlarm();
    }
    return response;
  }

  // The design's Community post's link as the doors read it: its code, and whether it opens the design now
  // (community-post.ts openCommunityCode). Null for a design with no post.
  async community(designId: string): Promise<{ code: string; open: boolean } | null> {
    this.bindDesign(designId);
    return this.communityOf(designId);
  }

  // Never makes a schema: a request for an id nothing has written finds no post.
  private async communityOf(designId: string): Promise<{ code: string; open: boolean } | null> {
    if (!this.storedSchema()) return null;
    const env = this.requireEnv();
    const post = await readCommunityPost(env);
    if (!post) return null;
    const meta = await readDesignMeta(env, designId);
    return { code: post.shareCode, open: openCommunityCode(env, post, meta) === post.shareCode };
  }

  // The post when `code` is its link and it opens the design now; null otherwise.
  private async openPost(designId: string, code: string): Promise<CommunityPost | null> {
    this.bindDesign(designId);
    if (!this.storedSchema()) return null;
    const env = this.requireEnv();
    const post = await readCommunityPost(env);
    if (!post || post.shareCode !== code) return null;
    const meta = await readDesignMeta(env, designId);
    return openCommunityCode(env, post, meta) === code ? post : null;
  }

  // What a visitor through the design's Community post's open link is told of the post (docs/specs/025-community/
  // community.md "Viewing a post's design"): its id at the service and who it shows as author.
  async communityListing(designId: string, code: string): Promise<CommunityListing | null> {
    const post = await this.openPost(designId, code);
    if (!post) return null;
    return { postId: post.postId, author: await communityPostAuthor(this.requireEnv(), post) };
  }

  // A copy through the design's Community post's link is named after the post (docs/specs/025-community/
  // community.md "Viewing a post's design"): its title, when `code` is the post's open link. Null otherwise.
  async communityPostTitle(designId: string, code: string): Promise<string | null> {
    return (await this.openPost(designId, code))?.title ?? null;
  }

  // Whether this object's SQLite holds a design schema: an id nothing has written answers no post.
  private storedSchema(): boolean {
    const sql = this.state.storage.sql;
    return this.schemaReady || (!!sql && hasDesignSchema((q) => sql.exec(q)));
  }

  // The design drawn for liveworkspace's previews (liveworkspace/docs/specs/006-media/previews.md "The export door"): the first tab or
  // the one asked for, versioned by its last save. Stores nothing; the platform keeps and serves the picture.
  async exportImage(designId: string, query: ExportQuery): Promise<ExportResult> {
    this.bindDesign(designId);
    // A design this object never held: nothing to draw, and no schema made just to say so.
    const sql = this.state.storage.sql;
    if (!hasDesignSchema((q) => sql.exec(q))) return { status: 'not_found' };
    const env = this.requireEnv();
    const { meta, savedAt } = await readDesignHead(env, designId);
    if (!meta) return { status: 'not_found' };
    // Through the design's Community post's link it is the redacted drawing, and nothing while the post does not
    // open the design (docs/specs/025-community/community.md "Viewing a post's design").
    let community = false;
    if (query.code !== null) {
      const post = await readCommunityPost(env);
      if (post?.shareCode === query.code) {
        if (openCommunityCode(env, post, meta) !== query.code) return { status: 'not_found' };
        community = true;
      }
    }
    if (query.ifVersion === savedAt) return { status: 'unchanged', version: savedAt };
    if (query.tabId !== null && !(await designHasTab(env, designId, query.tabId))) {
      return { status: 'not_found' };
    }
    const svg = await drawDesign(env, { id: designId, name: meta.name }, query.tabId, {
      defer: (p) => this.state.waitUntil(p),
      community,
    });
    return svg === null
      ? { status: 'empty', version: savedAt }
      : { status: 'ok', body: svg, contentType: SVG_CONTENT_TYPE, version: savedAt };
  }

  // The export door's `file` format (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps", design-file.ts): the
  // design's whole envelope, its last save as the version, unread when the caller holds that save.
  async exportFile(designId: string, query: ExportQuery): Promise<ExportResult> {
    this.bindDesign(designId);
    const sql = this.state.storage.sql;
    if (!hasDesignSchema((q) => sql.exec(q))) return { status: 'not_found' };
    return exportDesignFile(this.requireEnv(), designId, query.ifVersion);
  }

  // A new design from a Drive file (routes/internal-file.ts read it): its tabs land as a copy's do, and it starts as
  // its owner's.
  async importFile(designId: string, file: DesignFileImport): Promise<void> {
    this.bindDesign(designId);
    await importDesignFile(this.requireEnv(), designId, file);
  }

  async hasTab(designId: string, tabId: string): Promise<boolean> {
    this.bindDesign(designId);
    return designHasTab(this.requireEnv(), designId, tabId);
  }

  async servesImage(designId: string, imageId: string, onlyTabId: string | null): Promise<boolean> {
    this.bindDesign(designId);
    return designServesImage(this.requireEnv(), designId, imageId, onlyTabId);
  }

  async heldBlobs(designId: string, tabId: string, ids: string[]): Promise<PhotoBlobMeta[]> {
    this.bindDesign(designId);
    return heldBlobs(this.requireEnv(), tabId, ids.slice(0, PHOTO_ADOPT_MAX_IDS));
  }

  // The source side of a copy, for whoever copies (design-content.ts exportDesignCopy): anyone but the owner takes
  // the comments as the tab read serves them to them; a copy through the design's open Community post's link takes it
  // without its comments or the people on its actions (docs/specs/025-community/community.md). `community` says
  // which, so the copy is counted toward the post.
  async exportCopy(
    designId: string,
    onlyTabId: string | null,
    copier: Copier | null,
  ): Promise<CopySource | null> {
    this.bindDesign(designId);
    const env = this.requireEnv();
    const post = copier?.code ? await this.communityOf(designId) : null;
    const community = post !== null && post.open && post.code === copier?.code;
    const copy = await exportDesignCopy(env, designId, onlyTabId, copier?.by ?? null, community);
    return copy ? { copy, community } : null;
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

  // Share links the index revoked: each one's sessions hear it and end now, as the worker's own revoke does.
  async revokeCodes(
    designId: string,
    codes: string[],
    reason: 'revoked' | 'rescoped' = 'revoked',
  ): Promise<number> {
    this.bindDesign(designId);
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

  // Someone opened the design through a share link for the first time: the owner hears of it (email/notifications.ts
  // notifyDesignJoin), off the caller's path. A design never started has no owner to tell.
  async joined(designId: string, personId: string): Promise<void> {
    this.bindDesign(designId);
    const env = this.requireEnv();
    const meta = await readDesignMeta(env, designId);
    if (!meta) return;
    this.state.waitUntil(
      notifyDesignJoin(env, { id: designId, ownerId: meta.ownerId, name: meta.name }, personId),
    );
  }

  // A closed account's name off this design (design-anonymise.ts): the index's person purge, through the api.
  async anonymise(designId: string, personId: string): Promise<number> {
    this.bindDesign(designId);
    // A design never started (or purged) holds nothing of anyone: read its storage as it is, without making the
    // schema and design row a first query would.
    const sql = this.state.storage.sql;
    const started =
      sql.exec(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'design'`).toArray()
        .length > 0 &&
      sql.exec('SELECT 1 FROM design WHERE id = ? AND created_at > 0', designId).toArray().length >
        0;
    if (!started) return 0;
    const changed = await anonymiseDesign(this.requireEnv(), designId, personId);
    // The owner may have been the one anonymised: the next grant reads the stored copy again.
    this.head.forget();
    if (changed > 0) console.info('[room] anonymised a closed account', { rows: changed });
    return changed;
  }

  // Take the owner and team a grant names as the design's own copy. A failure is logged, never the caller's: the
  // next grant tries again.
  private async takeHead(grant: { owner?: string | null; team: string | null }): Promise<void> {
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

  // What another holder of a shared tab sent. A design with nothing stored holds no tab, and makes no schema to say
  // so.
  async receiveShares(
    designId: string,
    from: string,
    messages: ShareMessage[],
  ): Promise<ShareAnswer[]> {
    const sql = this.state.storage.sql;
    if (this.designId === null && !hasDesignSchema((q) => sql.exec(q)))
      return messages.map(() => 'gone');
    this.bindDesign(designId);
    return designShares.receive(this.requireEnv(), designId, from, messages);
  }

  // A design going for good tells the other holders of its shared tabs it left, so their copies stop counting it.
  // Best effort: a holder that misses this hears `gone` the next time it sends here, and drops it then.
  private async leaveShares(): Promise<void> {
    const env = this.roomEnv;
    const designId = this.designId;
    const sql = this.state.storage.sql;
    if (!env || !designId || !sql || !hasDesignSchema((q) => sql.exec(q))) return;
    this.ensureSchema();
    await designShares.leaveAll(env, designId, (to, messages) =>
      designRoom(env, to).receiveShares(designId, messages),
    );
  }

  private requireEnv(): DesignEnv {
    if (!this.roomEnv) throw new Error('design room has no env');
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
        // Closed here rather than through closeSockets, which walks every socket: one pass for the whole room.
        try {
          ws.close(GRANT_LAPSED_CLOSE, 'grant-lapsed');
        } catch {
          // Already gone.
        }
        this.opRates.delete(ws);
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

  // A session's fresh grant (the `grant` frame): the same design, level and tab move its lapse on, and the design's
  // owner and team are taken from it. One that says something else (a level changed, a tab rescoped) ends the
  // session, and the editor rejoins with what it holds now. A grant that does not check is ignored; the old one
  // still lapses.
  async renewGrant(ws: WebSocket, ticket: unknown): Promise<void> {
    const env = this.roomEnv;
    const session = this.readSession(ws);
    if (!env || !session?.designId) return;
    const renewal = await renewRoomGrant(indexService, env, ticket, session.designId, {
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

  // Admit one server-side socket into the room: pin its hibernation-proof
  // session state (attachment) and hand it to the runtime. Split out of
  // fetch so tests can drive sessions without constructing WebSocketPair.
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
    // The room's size (docs/specs/015-api/api.md "Room size"): past ROOM_MAX_CONNECTIONS the socket is accepted
    // only to be closed with ROOM_FULL_CLOSE, which a browser can read where a refused upgrade says nothing. A
    // plain accept, not the hibernation one: the socket never joins, so the room never hears from it again.
    const connections = this.state.getWebSockets().length;
    if (roomIsFull(connections)) {
      console.info('[room] full', { connections });
      ws.accept();
      ws.close(ROOM_FULL_CLOSE, ROOM_FULL_REASON);
      return;
    }
    ws.serializeAttachment(
      newSessionAttachment(
        {
          verifiedRole,
          tabScope,
          shareCode,
          personTag,
          workbenchPairing,
          adderKey,
          designId,
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
  // Used by what is meant for one person (a released selection, who follows them): everyone else has no use for
  // the packet, and fanning it out would tell the whole room.
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

  // The design is gone for good: end every session, then drop everything stored here, which includes the
  // collaboration ledger's comment, idea and answer text, the order state and the alarm.
  // The ledger's queued writes land first, so none of them can re-create a key after the wipe.
  // That includes the design's content: its SQLite goes with everything else.
  async purge(designId?: string): Promise<void> {
    if (designId !== undefined) this.bindDesign(designId);
    this.closeSockets(() => [DESIGN_TRASHED_CLOSE, 'design-purged']);
    this.opLog = [];
    await this.leaveShares();
    // A design going for good takes its Community post with it: the service hears it is gone.
    if (this.designId !== null && this.storedSchema())
      await leaveCommunity(this.requireEnv(), this.designId);
    await this.ledger.settled();
    // What the design holds outside its own storage: its photo blobs' markers (and the blobs no other design
    // holds), and its images' references at the media service.
    const env = this.roomEnv;
    const id = this.designId;
    const blobs = env && this.schemaReady ? await designBlobIds(env) : [];
    await this.state.storage.deleteAlarm();
    await this.state.storage.deleteAll();
    if (env && id) {
      await releaseBlobs(env, id, blobs);
      await forgetDesignMediaRefs(env, id);
    }
    this.schemaReady = false;
    this.designRowReady = false;
    this.flushAt = null;
    this.shares.clear();
    this.maintenanceAt = null;
    this.communityAt = null;
    console.info('[room] purged');
  }

  // Ask the index where the Community post's design stands, and send the service what changed (community-post.ts).
  // A failure keeps the post and tries again at the next check.
  private async checkCommunity(now: number): Promise<void> {
    const designId = this.designId;
    this.communityAt = null;
    if (designId === null || !this.storedSchema()) return;
    const env = this.requireEnv();
    let post: CommunityPost | null;
    try {
      post = await checkCommunityPost(env, designId, await readDesignMeta(env, designId), now);
    } catch (error) {
      console.warn('[community] check failed', { error: String(error) });
      post = await readCommunityPost(env);
      if (post) {
        this.communityAt = now + COMMUNITY_CHECK_MS;
        return;
      }
    }
    this.communityAt = communityCheckDueAt(post);
  }

  // After a design-trashed op has gone out, close every socket
  // (docs/specs/013-workspace/trash.md): the design is in the Trash, and its
  // admission refuses every new join until it is restored.
  private closeAllIfTrashed(op: unknown): void {
    if ((op as { kind?: unknown } | null)?.kind !== 'design-trashed') return;
    this.closeSockets(() => [DESIGN_TRASHED_CLOSE, 'design-trashed']);
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
    // admitFrame in design-room-rules; this is the socket plumbing.
    const decision = admitFrame(this.opRates.get(ws), Date.now(), OP_RATE_CAP);
    this.opRates.set(ws, decision.rate);
    if (!decision.admit) return;
    const session = this.readSession(ws);
    if (!session) return;
    if (msg.kind === 'grant') {
      this.state.waitUntil(this.renewGrant(ws, (msg as { grant?: unknown }).grant));
      return;
    }
    if (msg.kind === 'identity') {
      // An identity update over the open socket (liveworkspace/docs/specs/003-accounts/accounts.md "Profile pictures"): Show My Google
      // Picture flipped. The hello rules again, keeping the tab this session is on, then a fresh roster. Not a
      // join, so none of the join's side effects run, and a session that never said hello has nothing to update.
      if (!session.presence) return;
      const next = helloPresence(msg.participant, session);
      if (session.presence.tabId !== undefined) next.tabId = session.presence.tabId;
      if (session.presence.besideTabId !== undefined)
        next.besideTabId = session.presence.besideTabId;
      ws.serializeAttachment({ ...session, presence: next } satisfies SessionAttachment);
      this.broadcastPresence();
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
      // The server's design format number (docs/specs/016-platform/new-version-prompt.md): an editor
      // older than it offers a reload. With the live build id (docs/specs/016-platform/stale-builds.md).
      const build = parseBuildId(this.roomEnv?.BUILD_ID);
      this.sendTo(ws, { kind: 'format', format: DESIGN_FORMAT, ...(build ? { build } : {}) });
      this.broadcastPresence();
      this.noteMultiplayer();
      return;
    }
    if (msg.kind === 'facilitator') {
      // The baton went with the session tools; freeing a held element is all this frame still asks.
      if (msg.action === 'unlock') this.releaseSelectionLock(session, msg.target, msg.elementId);
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
            designId: session.designId ?? null,
            adderKey: session.adderKey ?? null,
          },
          msg.op,
          msg.ref,
        );
        return;
      }
      // An Editor's element op the validator refuses goes nowhere; its sender alone hears why
      // (docs/specs/012-collaboration/realtime-conflict-resolution.md "An invalid element").
      if (!(gate.kind === 'relay' && gate.presence) && this.refusesElementOp(ws, msg)) return;
      const opKind = (msg.op as { kind?: unknown } | null | undefined)?.kind;
      const isPresenceOp = gate.kind === 'relay' && gate.presence;
      // Remember the sender's current tab so a future joiner learns it
      // from the presence list (tab-focus ops only fire on a switch, so
      // they're invisible to anyone who joins afterwards). Persisted to
      // the attachment — in-memory-only would forget everyone's tab on
      // the next hibernation and mis-place peers for every later joiner.
      // The live relay below still drives real-time updates for peers
      // already connected.
      // Every selection is noted for the api's held check, whatever the role; the check answers only
      // the sessions that may change the content (liveSessions, docs/specs/024-agents/agent-changesets.md
      // "Held elements"). The DO's output gate holds
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
        this.broadcast({ kind: 'op', from: sender.id, op: msg.op }, ws);
      } else {
        // No comment author id leaves the room, whatever a client sent: it is
        // the author's owner id, a guest's credential. And a posted comment
        // carries the name of the session that sent it, the one on its
        // cursor, not whatever the frame claimed (docs/specs/012-collaboration/collab-race-hardening.md).
        // A scoped session's whole tab relays without its name (room-scope.ts): the name is structure.
        const op = stampCommentAuthor(
          opForTheWire(opFromScopedSender(msg.op, session.tabScope ?? null)),
          sender,
        );
        const seq = this.sequenceMutation(sender.id, op, ws);
        // A Participant's own comment reaction (docs/specs/012-collaboration/comment-reactions.md) is written by
        // the room, as stamped: a Participant never saves a whole tab.
        if (gate.kind === 'participant-reaction') {
          void this.participantWrites.writeReaction(session.designId ?? null, op);
        }
        // The relay skips the sender, so tell it the seq its op took: its own
        // ops are already applied, and a reconnect must not replay them. The
        // op's `ref` comes back with it, so a save waiting on this op knows the
        // ledger has it (docs/specs/012-collaboration/collab-race-hardening.md phase 6).
        const ref = isRoomOpRef(msg.ref) ? { ref: msg.ref } : {};
        this.sendTo(ws, { kind: 'cursor', epoch: this.epoch, seq, ...ref });
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

  /**
   * Tell one peer to let go of an element (docs/specs/007-editor/live-app.md concurrent-selection lock).
   *
   * Sent to the holder's socket ALONE, which is the entire addressing scheme: a client is never told its own
   * presence id (docs/specs/015-api/public-api-and-tokens.md §6), so a broadcast naming a target would arrive at
   * nobody who could recognise it. The holder drops the selection and re-broadcasts its own `select`, which
   * clears the lock everywhere through the path that already exists.
   *
   * Any editor may ask; a view-role visitor cannot select or edit, so it cannot free an editor's hold. Silent on
   * every refusal: a room that answered would be telling a peer which presence ids are live.
   */
  private releaseSelectionLock(
    session: SessionAttachment,
    target: string,
    elementId: string,
  ): void {
    if (session.verifiedRole !== 'edit') return;
    const asker = session.presence?.id ?? session.presenceId;
    if (typeof target !== 'string' || target === asker) return;
    if (typeof elementId !== 'string' || elementId.length === 0) return;
    const holder = this.socketByPresence(target);
    if (!holder) return;
    // A tab-scoped session acts on its own tab only (docs/specs/013-workspace/tab-scoped-share-links.md): it frees a
    // hold only from someone working on that tab, never one on a tab it cannot reach.
    if (session.tabScope && this.readSession(holder)?.presence?.tabId !== session.tabScope) return;
    this.sendToPresence(target, { kind: 'selection-released', elementId, by: asker });
  }

  // The room's one alarm, at the earliest of: an agent presence expiry (agent-presence I5, PR29), the outbox's
  // next push, the Community post's next check, the design's next upkeep. None when nothing is due.
  private armAlarm(): void {
    const due = [
      this.agents.nextExpiry(),
      this.flushAt,
      this.shares.at,
      this.communityAt,
      this.maintenanceAt,
      this.nextGrantDue(),
    ].filter((t): t is number => t !== null);
    if (due.length === 0) void this.state.storage.deleteAlarm();
    else void this.state.storage.setAlarm(Math.min(...due));
  }

  /** Agent entries past their expiry go; the outbox pushes and the upkeep runs when due. Safe to call early. */
  override async alarm(): Promise<void> {
    const expired = await this.agents.sweep();
    for (const r of expired) agentPresenceLog('expired', r);
    if (expired.length > 0) this.broadcastPresence();
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

  // A trashed design or a changed link clears agent entries (room-agent-presence.ts, PR15).
  private async clearAgentsFor(op: unknown): Promise<void> {
    await clearAgentsForOp(this.agents, op, () => this.broadcastPresence(), 'design-trashed');
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
    if (presenceId) void this.selections.drop(presenceId).catch(() => {});
    // Exclude the departing socket explicitly: depending on when the
    // runtime prunes it from getWebSockets(), it could otherwise still
    // appear in the roster of this very broadcast.
    this.broadcastPresence(ws);
  }

  // The person tags of the hello'd sessions: who is looking at the design now, whom a phone notification skips
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
      live.set(p.id, {
        name: p.name,
        color: p.color,
        personTag: session.personTag ?? null,
        // Only someone who may change the content holds what they select: never a Viewer.
        holds: levelAtLeast(parseStoredLevel(p.role), 'participate'),
      });
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
