// One inbound frame on a room socket (plan-room.ts webSocketMessage) and what it asks of the room: hello, identity,
// grant, sync (catch-up), and a relayed op (its tab scope's structure kept). Each takes the room.
import { PROJECT_FORMAT, isRoomOpRef, parseBuildId } from '@liveplanner/api-schema';
import { opForTheWire, stampCommentAuthor } from '@liveplanner/project';
import { selectionFromOp } from '../room-selections';
import type { ClientMessage, ServerMessage } from '../types';
import { MAX_TAB_ID_LEN, admitFrame, helloPresence, resolveCatchup } from '../project-room-rules';
import { opForScope } from '../room-scope';
import { gateClientOp } from '../room-op-gate';
import { helloChangesRoster } from '@liveworkspace/api-kit/room-roster';
import { type SessionAttachment } from '../room-session';
import type { PlanRoom } from './plan-room';
import { scopeOf, sequenceMutation, sendTo } from './plan-room-sockets';
import { noteMultiplayer } from './plan-room-presence';

// Max ops a single session may broadcast per 1s window. Far above any
// legit client (cursor broadcasts are throttled to a few dozen
// per second), so this only ever bites a flood.
const OP_RATE_CAP = 240;

// Max size (chars) of a single inbound WebSocket frame. A cursor / select /
// op frame is well under this; the cap stops a socket from broadcasting a
// huge payload to every peer in the room.
const MAX_MESSAGE_CHARS = 256 * 1024;

// Length clamp on the tab id we persist into the attachment from hello /
// tab-focus frames. Real tab ids are UUIDs (36 chars); the clamp only
// exists so a hostile frame can't balloon the attachment (see the size
// note on SessionAttachment). MAX_TAB_ID_LEN comes from ./project-room-rules,
// which owns the clamp it applies to a hello frame's tabId.

// Hibernation event handler: one inbound frame from one socket. The DO
// may have just been re-materialized from cold — everything this needs
// beyond flood control comes from the socket's attachment.
export function webSocketMessage(
  room: PlanRoom,
  ws: WebSocket,
  message: string | ArrayBuffer,
): void {
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
  // admitFrame in project-room-rules; this is the socket plumbing.
  const decision = admitFrame(room.opRates.get(ws), Date.now(), OP_RATE_CAP);
  room.opRates.set(ws, decision.rate);
  if (!decision.admit) return;
  const session = room.readSession(ws);
  if (!session) return;
  if (msg.kind === 'grant') {
    room.state.waitUntil(room.renewGrant(ws, (msg as { grant?: unknown }).grant));
    return;
  }
  if (msg.kind === 'identity') {
    // An identity update (Show My Google Picture switched): the hello rules again, keeping the tab this session
    // is on, then a fresh roster. Not a join, so none of the join's side effects run; before hello, nothing.
    if (!session.presence) return;
    const next = helloPresence(msg.participant, session);
    if (session.presence.tabId !== undefined) next.tabId = session.presence.tabId;
    if (session.presence.besideTabId !== undefined) next.besideTabId = session.presence.besideTabId;
    ws.serializeAttachment({ ...session, presence: next } satisfies SessionAttachment);
    room.broadcastPresence();
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
    sendTo(room, ws, { kind: 'cursor', epoch: room.epoch, seq: room.seq });
    // The server's project format number (docs/specs/016-platform/new-version-prompt.md): an editor
    // older than it offers a reload. With the live build id (docs/specs/016-platform/stale-builds.md).
    const build = parseBuildId(room.roomEnv?.BUILD_ID);
    sendTo(room, ws, { kind: 'format', format: PROJECT_FORMAT, ...(build ? { build } : {}) });
    // A repeat hello that changes nothing on the roster sends nobody a new one, so one socket cannot make the
    // room rebuild every roster at the frame-rate cap. Nobody new is present either, so no multiplayer note.
    if (helloChangesRoster(session.presence, presence)) {
      room.broadcastPresence();
      noteMultiplayer(room);
    }
    return;
  }
  if (msg.kind === 'sync') {
    // A (re)connecting client asks what it missed (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1).
    // Answer from the in-memory op log or tell it to re-hydrate. Costs
    // no state change, so it's allowed from any connected session
    // (a view-only peer needs to catch up too).
    sendCatchup(room, ws, msg.epoch, typeof msg.lastSeq === 'number' ? msg.lastSeq : 0);
    return;
  }
  if (msg.kind === 'op') {
    const sender = session.presence;
    if (!sender) return;
    // The role gate (room-op-gate.ts): what this session may relay, by its server-verified role.
    const gate = gateClientOp(msg.op, {
      role: sender.role,
      tabScope: session.tabScope ?? null,
      tabShowsAll: session.tabShowsAll ?? false,
      key: sender.key,
    });
    if (gate.kind === 'drop') return;
    if (gate.kind === 'participant-content') {
      void room.participantWrites.applyContentOp(
        {
          ws,
          presenceId: sender.id,
          projectId: session.projectId ?? null,
          adderKey: session.adderKey ?? null,
        },
        msg.op,
        msg.ref,
      );
      return;
    }
    // An Editor's element op the validator refuses goes nowhere; its sender alone hears why
    // (docs/specs/012-collaboration/realtime-conflict-resolution.md "An invalid element").
    if (!gate.presence && refusesElementOp(room, ws, msg)) return;
    // A tab-scoped session's op keeps its tab's structure (room-scoped-structure.ts): checked, in order, before
    // it relays; everyone else's relays at once.
    if (session.tabScope && !gate.presence) {
      room.scopedStructure.admit(msg.op, session.tabScope, session.projectId ?? null, () =>
        relayClientOp(room, ws, session, sender, msg, gate),
      );
      return;
    }
    relayClientOp(room, ws, session, sender, msg, gate);
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
export function sendCatchup(
  room: PlanRoom,
  ws: WebSocket,
  epoch: string | null,
  lastSeq: number,
): void {
  const { ops, resync } = resolveCatchup(
    { epoch, lastSeq },
    { epoch: room.epoch, seq: room.seq, opLog: room.opLog },
  );
  // A tab-scoped session replays its own tab only, like the live relay.
  const scope = scopeOf(room, ws);
  const visible =
    scope === null
      ? ops
      : ops.flatMap((o) => {
          const op = opForScope(o.op, scope);
          return op === null ? [] : [{ ...o, op }];
        });
  const payload: ServerMessage = {
    kind: 'catchup',
    epoch: room.epoch,
    seq: room.seq,
    ops: visible,
    resync,
  };
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    room.opRates.delete(ws);
  }
}

export function refusesElementOp(
  room: PlanRoom,
  ws: WebSocket,
  msg: { op: unknown; ref?: unknown },
): boolean {
  const refused = room.elementGate(msg.op, msg.ref);
  if (refused) sendTo(room, ws, refused);
  return refused !== null;
}

// Relay one client op the gates let through: presence unordered, a mutation sequenced into the catch-up log.
export function relayClientOp(
  room: PlanRoom,
  ws: WebSocket,
  session: SessionAttachment,
  sender: NonNullable<SessionAttachment['presence']>,
  msg: Extract<ClientMessage, { kind: 'op' }>,
  gate: Extract<ReturnType<typeof gateClientOp>, { kind: 'relay' }>,
): void {
  if (gate.participantAnswers) {
    room.participantWrites.scheduleAnswers(
      session.projectId ?? null,
      (msg.op as { tabId?: unknown }).tabId,
    );
  }
  const opKind = (msg.op as { kind?: unknown } | null | undefined)?.kind;
  const isPresenceOp = gate.presence;
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
    void room.selections.note(sender.id, selectionFromOp(msg.op)).catch(() => {});
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
  // Presence ops relay unordered (ephemeral, no catch-up). Mutation
  // ops get a monotonic seq within the epoch and land in the catch-up
  // log so a reconnecting peer can replay the delta (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1).
  if (isPresenceOp) {
    room.broadcast({ kind: 'op', from: sender.id, op: msg.op }, ws);
  } else {
    // No comment author id leaves the room, whatever a client sent: it is
    // the author's owner id, a guest's credential. And a posted comment
    // carries the name of the session that sent it, the one on its
    // cursor, not whatever the frame claimed (docs/specs/012-collaboration/collab-race-hardening.md).
    const op = stampCommentAuthor(opForTheWire(msg.op), sender);
    const seq = sequenceMutation(room, sender.id, op, ws);
    // The relay skips the sender, so tell it the seq its op took: its own
    // ops are already applied, and a reconnect must not replay them. The
    // op's `ref` comes back with it, so a save waiting on this op knows the
    // ledger has it (docs/specs/012-collaboration/collab-race-hardening.md phase 6).
    const ref = isRoomOpRef(msg.ref) ? { ref: msg.ref } : {};
    sendTo(room, ws, { kind: 'cursor', epoch: room.epoch, seq, ...ref });
  }
}
