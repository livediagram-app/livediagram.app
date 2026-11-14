import { DOCUMENT_FORMAT, isRoomOpRef, parseBuildId, type NudgeOp } from '@livehuddle/api-schema';
import { opForTheWire, stampCommentAuthor, stampSenderName } from '@livehuddle/document';
import { helloChangesRoster } from '@liveworkspace/api-kit/room-roster';
import { followerIdsOf, followTargetOf } from '@liveworkspace/api-kit/room-follows';
import { admitFrame, helloPresence, MAX_TAB_ID_LEN, resolveCatchup } from '../document-room-rules';
import { opForScope, scopedTabOp } from '../room-scope';
import { gateClientOp } from '../room-op-gate';
import { selectionFromOp } from '../room-selections';
import type { SessionAttachment } from '../room-session';
import type { ClientMessage, ParticipantPresence, ServerMessage } from '../types';
import { storedTabName } from './room-content-state';
import { noteCallSession, relayNudge } from './room-call-sessions';
import { noteAttendance } from './room-attendance';
import { nameVisitor, storedVisitorName } from './room-names';
import { isVisitorSecret, visitorCollabKey } from '../visitor-key';
import { relaySessionOf, scopeOf } from './room-sockets';
import type { DocumentRoom } from './document-room';

// One inbound frame and what it asks of the room (document-room.ts webSocketMessage): the hello, a sync, a
// facilitator message, and every op, gated, relayed, addressed or sequenced. Each function takes the room it acts for.

// Max ops a single session may broadcast per 1s window. Far above any
// legit client (cursor / laser broadcasts are throttled to a few dozen
// per second), so this only ever bites a flood.
const OP_RATE_CAP = 240;

// Max size (chars) of a single inbound WebSocket frame. A cursor / select /
// op frame is well under this; the cap stops a socket from broadcasting a
// huge payload to every peer in the room.
const MAX_MESSAGE_CHARS = 256 * 1024;

// Length clamp on the tab id we persist into the attachment from hello /
// tab-focus frames. Real tab ids are UUIDs (36 chars); the clamp only
// exists so a hostile frame can't balloon the attachment (see the size
// note on SessionAttachment). MAX_TAB_ID_LEN comes from ../document-room-rules,
// which owns the clamp it applies to a hello frame's tabId.

// Hibernation event handler: one inbound frame from one socket. The DO
// may have just been re-materialized from cold: everything this needs
// beyond flood control comes from the socket's attachment.
export function roomMessage(
  room: DocumentRoom,
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
  // admitFrame in document-room-rules; this is the socket plumbing.
  const decision = admitFrame(room.opRates.get(ws), Date.now(), OP_RATE_CAP);
  room.opRates.set(ws, decision.rate);
  if (!decision.admit) return;
  const session = room.readSession(ws);
  if (!session) return;
  if (msg.kind === 'grant') {
    room.state.waitUntil(room.renewGrant(ws, (msg as { grant?: unknown }).grant));
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
    // smuggle arbitrary keys or oversize strings into the attachment:
    // see the size note on SessionAttachment.
    // A session with no identity takes its browser's key from its first hello (docs/specs/013-workspace/
    // share-roles.md "The collab key"), so a reconnect is the same visitor; never one with an identity, and never
    // a second time.
    const keyed = withVisitorKey(session, (msg as { visitor?: unknown }).visitor);
    // The name is the room's pick, never the hello's (room-names.ts): a person's profile name from the upgrade, the
    // name this browser typed when it has no identity, or its key's guest name.
    const presence = helloPresence(msg.participant, keyed, storedVisitorName(room, keyed));
    const batches = (msg as { batches?: unknown }).batches === true;
    const leanAvatars = (msg as { leanAvatars?: unknown }).leanAvatars === true;
    const hello = { ...keyed, presence, batches, leanAvatars } satisfies SessionAttachment;
    ws.serializeAttachment(hello);
    room.presenceRelay.noteSession(ws, relaySessionOf(hello));
    // Who is in which tab, for its Attendance (docs/specs/012-collaboration/tab-attendance.md).
    noteAttendance(room, ws, session, hello);
    // The session's own collab key, to its socket alone (docs/specs/013-workspace/share-roles.md "The collab
    // key"): its editor records its answers and reactions under it from now on.
    if (presence.key) room.sendTo(ws, { kind: 'collab-key', key: presence.key });
    // Where the ordered stream stands as this session joins, so a later
    // reconnect asks for what came after it, not for the whole log.
    room.sendTo(ws, { kind: 'cursor', epoch: room.epoch, seq: room.seq });
    // The server's document format number (docs/specs/016-platform/new-version-prompt.md): an editor
    // older than it offers a reload. With the live build id (docs/specs/016-platform/stale-builds.md).
    const build = parseBuildId(room.roomEnv?.BUILD_ID);
    // `leanAvatars`: this room fills lean avatar packets back out for an older editor, so a new one may send them.
    room.sendTo(ws, {
      kind: 'format',
      format: DOCUMENT_FORMAT,
      ...(build ? { build } : {}),
      leanAvatars: true,
    });
    // A repeat hello that changes nothing on the roster sends nobody a new one, so one socket cannot make the
    // room rebuild every roster at the frame-rate cap. Nobody new is present either, so no multiplayer note.
    if (helloChangesRoster(session.presence, presence)) {
      room.broadcastPresence();
      room.noteMultiplayer();
    }
    room.baton.welcome(ws, session, presence.id, msg.facilitatorToken);
    return;
  }
  if (msg.kind === 'visitor-name') {
    nameVisitor(room, ws, session, (msg as { name?: unknown }).name);
    return;
  }
  if (msg.kind === 'facilitator') {
    room.baton.handle(msg, session);
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
      key: sender.key,
      adderKey: session.adderKey ?? null,
    });
    if (gate.kind === 'drop') return;
    // The parsed copy of an op the gate parses is what the room acts on and relays: never the frame as sent.
    if (gate.kind === 'relay' && gate.op !== undefined) msg = { ...msg, op: gate.op };
    if (gate.kind === 'participant-content') {
      void room.participantWrites.applyContentOp(
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
    if (!gate.presence && refusesElementOp(room, ws, msg)) return;
    if (gate.participantAnswers) {
      room.participantWrites.scheduleAnswers(
        session.documentId ?? null,
        (msg.op as { tabId?: unknown }).tabId,
      );
    }
    const opKind = (msg.op as { kind?: unknown } | null | undefined)?.kind;
    const isPresenceOp = gate.presence;
    // Remember the sender's current tab so a future joiner learns it
    // from the presence list (tab-focus ops only fire on a switch, so
    // they're invisible to anyone who joins afterwards). Persisted to
    // the attachment: in-memory-only would forget everyone's tab on
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
        // The tabs it showed before the move (`sender` is changed in place below), for its Attendance.
        const before = { ...session, presence: { ...sender } } satisfies SessionAttachment;
        sender.tabId = tabId.slice(0, MAX_TAB_ID_LEN);
        // The other pane of a side by side split (docs/specs/007-editor/split-view.md "Presence"),
        // clamped like tabId; anything but a string clears it. A tab-scoped session has one tab
        // and no split, so it never holds one.
        if (typeof besideTabId === 'string' && !session.tabScope)
          sender.besideTabId = besideTabId.slice(0, MAX_TAB_ID_LEN);
        else delete sender.besideTabId;
        const moved = { ...session, presence: sender } satisfies SessionAttachment;
        ws.serializeAttachment(moved);
        room.presenceRelay.noteSession(ws, relaySessionOf(moved));
        room.presenceRelay.catchUp(ws, sender.id);
        noteAttendance(room, ws, before, moved);
      }
    }
    // A follow is the room's to keep, never relayed: it tells the people followed, on their own sockets.
    if (opKind === 'follow') {
      noteFollow(room, ws, session, sender, msg.op);
      return;
    }
    // Presence ops relay unordered (ephemeral, no catch-up). Mutation
    // ops get a monotonic seq within the epoch and land in the catch-up
    // log so a reconnecting peer can replay the delta (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1).
    if (isPresenceOp) {
      // A shove (docs/specs/008-canvas/avatar-mode.md) is ADDRESSED, not broadcast: it asks one peer to
      // step aside, and only the room knows which socket that is. Presence
      // ids are server-minted precisely so a client never learns another
      // peer's real owner id (docs/specs/015-api/public-api-and-tokens.md §6), which also means a receiver can't
      // recognise its own id in the packet. So the routing happens here, and
      // a client acts on any avatar-push that reaches it.
      // A let-speak (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Raise hand") is addressed the same
      // way: only the hand's owner acts on it, and it cannot recognise its own id in a broadcast.
      // The room checks a let-speak's sender may let anyone speak (#495), and keeps what the hearing check reads.
      if (opKind === 'avatar-let-speak' && !room.calls.letSpeak(sender.id, msg.op)) {
        console.warn('[calls] let-speak refused');
        return;
      }
      if (opKind === 'avatar') room.calls.noteAvatar(sender.id, msg.op);
      if (opKind === 'avatar-hand') room.calls.noteHand(sender.id, msg.op);
      if (opKind === 'call-track') room.calls.noteTrack(sender.id, msg.op);
      // A call proves its session (proximity-audio.md "The wire"): checked, kept, never relayed.
      if (opKind === 'call-session') {
        void noteCallSession(room, ws, msg.op);
        return;
      }
      // An Editor stopping someone's share (#469; the gate let only an Editor's through): addressed like a shove.
      if (opKind === 'call-stop-share') {
        const targetId = (msg.op as { targetId: string }).targetId;
        room.calls.stopShare(targetId);
        room.sendToPresence(targetId, { kind: 'op', from: sender.id, op: msg.op }, ws);
        return;
      }
      // A knock (docs/specs/012-collaboration/knock.md): one per sender per 10 seconds, then broadcast below; each
      // receiver checks it stands in the room. Its answer is addressed to the knocker, as a shove is.
      if (opKind === 'avatar-knock' && !room.knocks.allow(sender.id, Date.now())) return;
      // A ring of the bell, likewise one per sender per 5 seconds, then broadcast; each receiver checks its earshot.
      if (opKind === 'avatar-bell' && !room.bells.allow(sender.id, Date.now())) return;
      // A game's moment, at most GAME_EVENT_CAP per sender per second (social-pieces.md "A cap per sender"): a fast
      // rally is one or two a second, so only a flood meets it.
      if (opKind === 'game-event' && !room.gameEvents.allow(sender.id, Date.now())) return;
      // A nudge (docs/specs/012-collaboration/nudge.md "The wire"): to its target alone, once per 2 minutes per
      // pair; inside that the sender alone is told how long is left. Never fanned out.
      if (opKind === 'nudge') {
        relayNudge(room, ws, session, msg.op as NudgeOp);
        return;
      }
      if (
        opKind === 'avatar-push' ||
        opKind === 'avatar-let-speak' ||
        opKind === 'avatar-knock-answer'
      ) {
        const targetId = (msg.op as { targetId?: unknown }).targetId;
        if (typeof targetId === 'string') {
          room.sendToPresence(targetId, { kind: 'op', from: sender.id, op: msg.op }, ws);
        }
        return;
      }
      if (opKind === 'avatar-voice' || opKind === 'call-track') void room.callsWatch.note();
      // A silent publishing call asks the room to read the kill switch (docs/specs/016-platform/
      // calls-kill-switch.md "The room tells its clients"): noted, never relayed.
      if (opKind === 'calls-check') {
        void room.callsWatch.note();
        return;
      }
      if (room.presenceRelay.relay(ws, sender.id, msg.op)) return;
      room.broadcast({ kind: 'op', from: sender.id, op: msg.op }, ws);
    } else {
      // No comment author id leaves the room, whatever a client sent: it is
      // the author's owner id, a guest's credential. And a posted comment
      // carries the name of the session that sent it, the one on its
      // cursor, not whatever the frame claimed (docs/specs/012-collaboration/collab-race-hardening.md).
      // So does a pinned note's author and a posted score's name (docs/specs/009-elements/social-pieces.md "The author
      // is the sender's"), so nobody pins or posts under a colleague's name.
      // A scoped session's whole-tab op goes out under the stored name: it may not rename its tab
      // (docs/specs/013-workspace/tab-scoped-share-links.md "No rename from a scoped session").
      const scoped = scopedTabOp(msg.op, session.tabScope ?? null, (tabId) =>
        storedTabName(room, tabId),
      );
      const op = stampSenderName(
        stampCommentAuthor(opForTheWire(scoped), sender, session.reactionPerson ?? null),
        sender.name,
      );
      const seq = room.sequenceMutation(sender.id, op, ws);
      // The relay skips the sender, so tell it the seq its op took: its own
      // ops are already applied, and a reconnect must not replay them. The
      // op's `ref` comes back with it, so a save waiting on this op knows the
      // ledger has it (docs/specs/012-collaboration/collab-race-hardening.md phase 6).
      const ref = isRoomOpRef(msg.ref) ? { ref: msg.ref } : {};
      room.sendTo(ws, { kind: 'cursor', epoch: room.epoch, seq, ...ref });
    }
  }
}

// The session with its browser's collab key, when it has no identity, has said no hello yet and this hello carries a
// visitor secret (visitor-key.ts); else the session as it is.
function withVisitorKey(session: SessionAttachment, visitor: unknown): SessionAttachment {
  if (!session.keyMinted || session.presence !== null || !isVisitorSecret(visitor)) return session;
  const { keyMinted: _minted, ...rest } = session;
  return { ...rest, collabKey: visitorCollabKey(visitor) };
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
function sendCatchup(
  room: DocumentRoom,
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

// The element gate (the room's `elementGate`): answers a refused op to its sender alone.
function refusesElementOp(
  room: DocumentRoom,
  ws: WebSocket,
  msg: { op: unknown; ref?: unknown },
): boolean {
  const refused = room.elementGate(msg.op, msg.ref);
  if (refused) room.sendTo(ws, refused);
  return refused !== null;
}

// Who this session follows (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"): kept on the
// session, then the person it stopped following and the one it now follows each hear their new list.
function noteFollow(
  room: DocumentRoom,
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
  if (before) sendFollowers(room, before);
  if (target) sendFollowers(room, target);
}

// Tell `target` who follows them, on their socket alone; `except` is a socket on its way out.
export function sendFollowers(room: DocumentRoom, target: string, except?: WebSocket): void {
  const sessions = room.state
    .getWebSockets()
    .filter((s) => s !== except)
    .map((s) => room.readSession(s))
    .map((s) => ({ presenceId: s?.presence?.id, following: s?.following }));
  room.sendToPresence(target, { kind: 'followers', ids: followerIdsOf(sessions, target) }, except);
}
