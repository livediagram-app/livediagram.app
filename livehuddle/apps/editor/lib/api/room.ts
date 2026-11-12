// Realtime room (WebSocket) connection.
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livehuddle/api-schema` so the editor and
// (eventually) any other client share one definition. `RoomHandlers`
// (room-contract.ts, re-exported here) is the client-side callback shape
// only, not on the wire.
import {
  ACCESS_CHANGED_CLOSE,
  DOCUMENT_TRASHED_CLOSE,
  GRANT_LAPSED_CLOSE,
  ROOM_FULL_CLOSE,
  ROOM_FULL_RETRY_MS,
  ROOM_PING,
  ROOM_PONG,
  type RoomIncoming,
  type RoomOp,
  type RoomOutgoing,
} from '@livehuddle/api-schema';
import { isCollabKey } from '@liveworkspace/api-schema/collab-key';
import { opForTheWire } from '@livehuddle/document';
import { splitPresenceFrame } from '../agent-presence-rows';
import { noteServerBuild, noteServerDocumentFormat } from '../server-release';
import { startEditorTiming } from '../timing';
import { wsUrl } from './core';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { createAvatarPacker } from '@livehuddle/avatar/relay';
import {
  MAX_RECONNECT_ATTEMPTS,
  OUTBOX_MAX,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  ROOM_KEEPALIVE_IDLE_MS,
  ROOM_KEEPALIVE_TICK_MS,
  ROOM_KEEPALIVE_TIMEOUT_MS,
  ROOM_SEQUENCE_ACK_TIMEOUT_MS,
  isOutboxOp,
  roomQueryString,
  type RoomConnectOptions,
  type RoomHandlers,
  type RoomSelf,
} from './room-contract';

export {
  ROOM_FULL_NOTICE,
  ROOM_KEEPALIVE_IDLE_MS,
  ROOM_KEEPALIVE_TIMEOUT_MS,
  ROOM_SEQUENCE_ACK_TIMEOUT_MS,
  roomQueryString,
  type RoomHandlers,
} from './room-contract';

export function connectRoom(
  documentId: string,
  // `key` is the document-write id (docs/specs/012-collaboration/participant-responses.md), relayed to peers verbatim so
  // an answer saved on the document can be joined back to the person in the
  // roster. The room OVERRIDES `id` with its own per-socket presence id
  // (docs/specs/015-api/public-api-and-tokens.md §6), which is why the two are separate fields.
  participant: RoomSelf,
  handlers: RoomHandlers,
  options: RoomConnectOptions = {},
  // Read at every (re)connect rather than captured once: the baton can be
  // taken while this socket is open, and the token we present has to be the
  // one we hold NOW (docs/specs/012-collaboration/facilitator.md).
  readFacilitatorToken?: () => string | null,
): {
  send: (msg: RoomOutgoing) => void;
  close: () => void;
  cursor: () => { epoch: string; seq: number } | null;
  sequence: (op: RoomOp) => Promise<boolean>;
} {
  // The ticket rides the query string (see roomQueryString); every reconnect mints a fresh one,
  // even after a mint that failed.
  let ticket = options.ticket ?? null;
  const urlNow = () => {
    const qs = roomQueryString(ticket);
    return wsUrl(`/documents/${documentId}/ws${qs ? `?${qs}` : ''}`);
  };

  // Null until the first ticket is minted and the first socket made.
  let ws: WebSocket | null = null;
  const isOpen = () => ws?.readyState === WebSocket.OPEN;
  // The latest selection, tab focus and call locator we told the room, said again on every new socket (see send).
  const lastSaid = new Map<string, RoomOutgoing>();
  let closed = false; // the caller called close() — never reconnect after that
  let opened = false; // we've had at least one successful session (→ reconnects sync)
  let attempts = 0;
  // Lean avatar packets (docs/specs/008-canvas/avatar-mode.md "The costume rides only when it is needed"): sent only
  // once this socket's room said it takes them in its `format` frame, so a room from before keeps getting full ones.
  let leanAvatars = false;
  const avatarPacker = createAvatarPacker();
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Out of attempts and waiting for the network or the tab to come back (see MAX_RECONNECT_ATTEMPTS).
  let parked = false;
  // Turned away by a full room since we last joined, so the warning is said once (see onRoomFull).
  let roomFull = false;

  // Ordering cursor for reconnect catch-up (docs/specs/012-collaboration/realtime-conflict-resolution.md, Level 1): the last
  // epoch + seq we applied off an ordered op. On reopen we hand these to the
  // room, which replays what we missed or tells us to re-hydrate.
  let lastEpoch: string | null = null;
  let lastSeq = 0;
  // See OUTBOX_MAX. Flushed, in order, once a (re)opened socket has said
  // hello and asked for what it missed.
  let outbox: RoomOutgoing[] = [];
  // Ops waiting for the room to say it sequenced them, by the `ref` each was sent with. A socket that
  // drops answers them all false: the room may never have read them.
  let lastRef = 0;
  const awaitingRef = new Map<number, (sequenced: boolean) => void>();
  const settleAll = (sequenced: boolean) => {
    const waiting = [...awaitingRef.values()];
    awaitingRef.clear();
    for (const settle of waiting) settle(sequenced);
  };

  // How long the room takes to come alive, and to come back after a drop
  // (docs/specs/017-telemetry/timing-telemetry.md): to the first roster frame, retries and back-off
  // included. A connection that is closed or never lands records nothing.
  let connectTiming: ReturnType<typeof startEditorTiming> | null = startEditorTiming('RoomConnect');
  let reconnectTiming: ReturnType<typeof startEditorTiming> | null = null;
  const settleTimings = (live: boolean) => {
    for (const timing of [connectTiming, reconnectTiming]) {
      if (live) timing?.end();
      else timing?.cancel();
    }
    connectTiming = null;
    reconnectTiming = null;
  };

  const applyOp = (from: string, op: RoomOp, seq?: number, epoch?: string) => {
    if (typeof seq === 'number') lastSeq = seq;
    if (typeof epoch === 'string') lastEpoch = epoch;
    handlers.onOp(from, op);
  };

  // The current socket's keepalive, stopped when the caller closes the connector (a dead socket may never fire close).
  let stopSocketKeepalive = () => {};
  const open = () => {
    const socket = new WebSocket(urlNow());
    ws = socket;
    // This socket, as opposed to `opened` (any session so far).
    let socketOpened = false;
    // The close of this socket is handled once: by its close event, or first by the keepalive finding it dead.
    let closeHandled = false;
    // The keepalive's view of this socket: when anything last arrived, and the ping awaiting an answer.
    let lastHeard = Date.now();
    let pingSentAt: number | null = null;
    let keepalive: ReturnType<typeof setInterval> | null = null;
    const stopKeepalive = () => {
      if (keepalive !== null) clearInterval(keepalive);
      keepalive = null;
    };
    stopSocketKeepalive = stopKeepalive;
    const checkAlive = () => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      if (pingSentAt !== null) {
        if (lastHeard >= pingSentAt) pingSentAt = null;
        else if (now - pingSentAt >= ROOM_KEEPALIVE_TIMEOUT_MS) {
          debugLog('[room] keepalive unanswered; treating the socket as dropped');
          stopKeepalive();
          try {
            socket.close();
          } catch {
            // Already closing.
          }
          onClose({ code: 1006 } as CloseEvent);
          return;
        }
      }
      if (pingSentAt === null && now - lastHeard >= ROOM_KEEPALIVE_IDLE_MS) {
        pingSentAt = now;
        socket.send(ROOM_PING);
      }
    };
    socket.addEventListener('open', () => {
      // A new socket: full packets until its room says otherwise, and the next one carries the costume.
      leanAvatars = false;
      avatarPacker.reset();
      socketOpened = true;
      lastHeard = Date.now();
      keepalive = setInterval(checkAlive, ROOM_KEEPALIVE_TICK_MS);
      attempts = 0;
      // The baton coming home (docs/specs/012-collaboration/facilitator.md): on a reconnect this is what tells
      // the room we are the same facilitator it granted before the refresh.
      const facilitatorToken = readFacilitatorToken?.();
      socket.send(
        JSON.stringify({
          kind: 'hello',
          participant,
          // A busy room may coalesce our samples into one `batch` frame a step (docs/specs/015-api/api.md "A busy
          // room bounds its presence fan-out"); saying so is what lets it.
          batches: true,
          // We read lean avatar packets, keeping each peer's last costume; the room fills them out for older editors.
          leanAvatars: true,
          ...(facilitatorToken ? { facilitatorToken } : {}),
        } satisfies RoomOutgoing),
      );
      // A reconnect (not the first open): ask the room for the ops we missed
      // while we were gone before resuming live traffic.
      if (opened) {
        socket.send(
          JSON.stringify({ kind: 'sync', epoch: lastEpoch, lastSeq } satisfies RoomOutgoing),
        );
      }
      opened = true;
      // A new socket is a new presence id: nobody follows it yet, and our own follow is said again.
      handlers.onFollowers?.([]);
      const following = options.readFollowing?.();
      if (following) {
        socket.send(
          JSON.stringify({
            kind: 'op',
            op: { kind: 'follow', target: following },
          } satisfies RoomOutgoing),
        );
      }
      // A new socket is a session the room knows nothing about: our selection (which holds elements
      // from an agent, docs/specs/024-agents/agent-changesets.md "Held elements") and our tab are
      // said again, including when they were set before this socket first opened.
      for (const msg of lastSaid.values()) socket.send(JSON.stringify(msg));
      const held = outbox;
      outbox = [];
      for (const msg of held) socket.send(JSON.stringify(msg));
    });
    socket.addEventListener('message', (e) => {
      lastHeard = Date.now();
      // The keepalive's answer: proof of life, nothing to apply.
      if (e.data === ROOM_PONG) return;
      // The room speaks JSON text frames; anything else is no message of ours.
      const data: unknown = e.data;
      if (typeof data !== 'string') {
        debugLog('[room] non-text frame ignored');
        return;
      }
      // One message from the room. A busy room's `batch` frame holds several, each handled as if sent alone.
      const handle = (msg: RoomIncoming): void => {
        if (msg.kind === 'presence') {
          roomFull = false;
          settleTimings(true);
          const frame = splitPresenceFrame(msg);
          handlers.onPresence(frame.participants, frame.agents);
          // Someone new is due our costume on the next packet.
          avatarPacker.noteRoster(frame.participants.map((p) => p.id));
        } else if (msg.kind === 'facilitator') handlers.onFacilitator?.(msg);
        else if (msg.kind === 'selection-released') handlers.onSelectionReleased?.(msg);
        else if (msg.kind === 'followers') handlers.onFollowers?.(msg.ids);
        // The server release signal (docs/specs/016-platform/new-version-prompt.md, stale-builds.md).
        else if (msg.kind === 'format') {
          noteServerDocumentFormat(msg.format);
          noteServerBuild(msg.build);
          leanAvatars = msg.leanAvatars === true;
        } else if (msg.kind === 'op') applyOp(msg.from, msg.op, msg.seq, msg.epoch);
        else if (msg.kind === 'grant-renew') {
          const asking = socket;
          void options.renewGrant?.().then((grant) => {
            if (grant && asking.readyState === WebSocket.OPEN) {
              asking.send(JSON.stringify({ kind: 'grant', grant } satisfies RoomOutgoing));
            }
          });
        } else if (msg.kind === 'cursor') {
          // Our own op's seq, or where the stream stood when we joined. A
          // different epoch is a restarted room: leave the cursor for the
          // sync / catchup exchange to reconcile.
          if (lastEpoch === null || lastEpoch === msg.epoch) {
            lastEpoch = msg.epoch;
            if (msg.seq > lastSeq) lastSeq = msg.seq;
          }
          if (msg.ref !== undefined) awaitingRef.get(msg.ref)?.(true);
        } else if (msg.kind === 'collab-key') {
          // A key of the wrong shape is no key of ours: the one we hold stays.
          if (isCollabKey(msg.key)) handlers.onCollabKey?.(msg.key);
        } else if (msg.kind === 'op-refused') {
          // An element op the room refused (docs/specs/012-collaboration/realtime-conflict-resolution.md "An
          // invalid element"): it reached nobody, so a save waiting on it stops waiting.
          console.warn('[room] op refused', { op: msg.op, reason: msg.reason, field: msg.field });
          if (msg.ref !== undefined) awaitingRef.get(msg.ref)?.(false);
        } else if (msg.kind === 'catchup') {
          if (msg.resync) {
            // Adopt the room's cursor first so we don't loop on the same
            // gap, then hand off to the caller's full re-hydrate.
            lastEpoch = msg.epoch;
            lastSeq = msg.seq;
            handlers.onResync?.();
          } else {
            for (const o of msg.ops) applyOp(o.from, o.op, o.seq, msg.epoch);
            lastEpoch = msg.epoch;
            if (msg.seq > lastSeq) lastSeq = msg.seq;
          }
        }
      };
      try {
        const msg = JSON.parse(data) as RoomIncoming;
        if (msg.kind === 'batch') for (const frame of msg.frames) handle(frame);
        else handle(msg);
      } catch {
        debugLog('[room] malformed frame ignored');
      }
    });
    const onClose = (event: CloseEvent) => {
      if (closeHandled) return;
      closeHandled = true;
      stopKeepalive();
      settleAll(false);
      handlers.onClose?.();
      if (closed) {
        settleTimings(false);
        return;
      }
      if (event?.code === DOCUMENT_TRASHED_CLOSE) {
        closed = true;
        settleTimings(false);
        handlers.onDocumentTrashed?.();
        return;
      }
      if (event?.code === ACCESS_CHANGED_CLOSE) {
        closed = true;
        settleTimings(false);
        handlers.onAccessChanged?.();
        return;
      }
      // A full room: say so once, then wait parked for the tab to be shown again or the minute's retry, whichever
      // comes first; a fast backoff would only hammer a room that is still full.
      if (event?.code === ROOM_FULL_CLOSE) {
        settleTimings(false);
        if (!roomFull) {
          roomFull = true;
          handlers.onRoomFull?.();
        }
        parked = true;
        if (reconnectTimer !== null) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(resume, ROOM_FULL_RETRY_MS, true);
        return;
      }
      // The grant lapsed with no fresh one in time (a sleeping tab, the index out of reach): reconnect at once with a
      // fresh ticket, which asks for a fresh grant; it spends no reconnect attempt.
      if (event?.code === GRANT_LAPSED_CLOSE && socketOpened) {
        reconnectTiming ??= startEditorTiming('RoomReconnect');
        void reopen();
        return;
      }
      if (!socketOpened) handlers.onRefused?.();
      // A live session dropped by itself: time the outage until the roster is back.
      if (socketOpened && connectTiming === null)
        reconnectTiming ??= startEditorTiming('RoomReconnect');
      backOff();
    };
    socket.addEventListener('close', onClose);
  };
  // The next attempt after the backoff's wait, or, out of attempts, parked until the network or the tab is back.
  const backOff = () => {
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      settleTimings(false);
      parked = true;
      debugLog('[room] reconnect attempts used up; waiting for the network or the tab');
      return;
    }
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempts);
    attempts++;
    reconnectTimer = setTimeout(() => void reopen(), delay);
  };
  // A reconnect, with a fresh ticket: the room spends each one it admits. A mint that throws never reached the api
  // (see mintTicket), so no socket opens: one without a ticket is always refused, and a refusal sends the editor
  // off to ask whether the document was trashed. The attempt waits out the backoff instead.
  const reopen = async () => {
    reconnectTimer = null;
    if (options.mintTicket) {
      try {
        ticket = await options.mintTicket();
      } catch {
        if (closed) return;
        debugLog('[room] ticket mint unreachable; backing off');
        backOff();
        return;
      }
      if (closed) return;
    }
    open();
  };
  // Without a ticket in hand, the first socket waits for one; the connector exists meanwhile, so what
  // the editor says before the room opens (its selection, its tab) is kept and said on open.
  if (ticket === null && options.mintTicket) void reopen();
  else open();

  // A fresh round of attempts once the browser is back online or the tab is shown again, only while parked.
  // `timed`: the full room's retry, which runs whether or not the tab is in view.
  const resume = (timed = false) => {
    if (closed || !parked) return;
    if (!timed && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (reconnectTimer !== null) clearTimeout(reconnectTimer);
    reconnectTimer = null;
    parked = false;
    attempts = 0;
    debugLog('[room] reconnecting after a wait');
    void reopen();
  };
  // A wake is never the timed retry (the listeners would otherwise hand `resume` their event).
  const onWake = () => resume();
  if (typeof window !== 'undefined') window.addEventListener('online', onWake);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onWake);
  const stopResuming = () => {
    if (typeof window !== 'undefined') window.removeEventListener('online', onWake);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onWake);
  };

  const send = (raw: RoomOutgoing) => {
    // No comment author id leaves this browser: it is its author's owner
    // id, a guest's credential, and the room hands every op to every socket
    // (docs/specs/012-collaboration/collab-race-hardening.md). One choke point for every send path.
    const msg: RoomOutgoing =
      raw.kind === 'op' ? { ...raw, op: opForTheWire(raw.op) as RoomOp } : raw;
    // State, not events: only the latest of each counts, so it is kept to say again on the next socket. Where our
    // call's media is too (proximity-audio.md "The wire"): a new socket is a new presence id that no peer has a
    // locator for, and nothing else would say it until someone new walked onto the tab. So is the proof of our call's
    // session (`call-session`): the room keeps it on the socket, so a new socket without it leaves everyone who asks
    // to hear us refused, and a speaker with nothing new to hear never proves it again on its own.
    if (
      msg.kind === 'op' &&
      (msg.op.kind === 'select' ||
        msg.op.kind === 'tab-focus' ||
        msg.op.kind === 'call-track' ||
        msg.op.kind === 'call-session')
    ) {
      lastSaid.set(msg.op.kind, msg);
    }
    // And our character, standing (avatar-mode.md "Realtime"): the room forgets it with the old presence id, and a
    // hidden tab sends no heartbeat, so without it a walker who reconnects in the background vanishes for everyone
    // and is no longer placed for the call's hearing check. Kept at rest: a step or a reaction replayed later is stale.
    if (msg.kind === 'op' && msg.op.kind === 'avatar') {
      if (msg.op.avatar === null) lastSaid.delete('avatar');
      else {
        const { reaction: _reaction, ...standing } = msg.op.avatar;
        lastSaid.set('avatar', {
          ...msg,
          op: {
            ...msg.op,
            avatar: { ...standing, walking: false, stepFrame: 0, lift: 0, wave: null },
          },
        });
      }
    }
    if (msg.kind === 'op' && msg.op.kind === 'avatar') {
      // Leaving the mode: whatever comes next is new to everyone, costume and all.
      if (msg.op.avatar === null) avatarPacker.reset();
      else if (leanAvatars && ws && isOpen()) {
        const avatar = avatarPacker.pack(msg.op.tabId, msg.op.avatar);
        ws.send(JSON.stringify({ ...msg, op: { ...msg.op, avatar } }));
        return;
      }
    }
    if (ws && isOpen()) ws.send(JSON.stringify(msg));
    else if (!closed && isOutboxOp(msg) && outbox.length < OUTBOX_MAX) outbox.push(msg);
  };

  return {
    send,
    // Send one op and learn whether the room sequenced it (docs/specs/012-collaboration/collab-race-hardening.md
    // phase 6): true once the room's `cursor` frame echoes the op's `ref`; false when the socket is down
    // (the op waits in the outbox, unconfirmed), drops, or the room stays silent past the timeout.
    sequence: (op) => {
      if (closed) return Promise.resolve(false);
      if (!isOpen()) {
        send({ kind: 'op', op });
        return Promise.resolve(false);
      }
      const ref = ++lastRef;
      return new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => {
          awaitingRef.delete(ref);
          console.warn('[room] op not confirmed in time', {
            kind: op.kind,
            timeoutMs: ROOM_SEQUENCE_ACK_TIMEOUT_MS,
          });
          resolve(false);
        }, ROOM_SEQUENCE_ACK_TIMEOUT_MS);
        awaitingRef.set(ref, (sequenced) => {
          clearTimeout(timer);
          awaitingRef.delete(ref);
          resolve(sequenced);
        });
        send({ kind: 'op', op, ref });
      });
    },
    // Where this client stands in the room's ordered stream, for a save to
    // tell the api what it has seen (docs/specs/012-collaboration/collab-race-hardening.md phase 3). Null while the socket
    // is down: a save made then is not merged with the room's ledger, because
    // what the client changed offline must not be overruled by the room.
    cursor: (): { epoch: string; seq: number } | null =>
      isOpen() && lastEpoch !== null ? { epoch: lastEpoch, seq: lastSeq } : null,
    close: () => {
      closed = true;
      stopResuming();
      settleTimings(false);
      outbox = [];
      settleAll(false);
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      stopSocketKeepalive();
      ws?.close();
    },
  };
}
