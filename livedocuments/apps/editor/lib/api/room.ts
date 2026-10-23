// Realtime room (WebSocket) connection.
//
// Wire-format types for room messages (`RoomOp`, `RoomOutgoing`,
// `RoomIncoming`) live in `@livedocuments/api-schema` so the editor and
// (eventually) any other client share one definition. `RoomHandlers`
// below is the client-side callback shape only — not on the wire —
// so it stays here next to the connect helper.
import {
  ACCESS_CHANGED_CLOSE,
  DOCUMENT_TRASHED_CLOSE,
  isMutationOpKind,
  ROOM_PING,
  ROOM_PONG,
  WORKBENCH_ENDED_CLOSE,
  type AgentPresence,
  type ParticipantPresence,
  type RoomIncoming,
  type RoomOp,
  type RoomOutgoing,
} from '@livedocuments/api-schema';
import { opForTheWire } from '@livedocuments/document';
import { splitPresenceFrame } from '../agent-presence-rows';
import { noteServerBuild, noteServerDocumentFormat } from '../server-release';
import { startEditorTiming } from '../timing';
import { wsUrl } from './core';
import { debugLog } from '../debug-log';

export type RoomHandlers = {
  // The room's agents arrive apart from the sessions (docs/specs/024-agents/agent-presence.md "In the editor").
  onPresence: (participants: ParticipantPresence[], agents: AgentPresence[]) => void;
  onOp: (from: string, op: RoomOp) => void;
  // Somebody has freed an element we were holding (docs/specs/007-editor/editor-app.md lock). Sent
  // to this socket alone, so being called IS the addressing — there is no id to
  // check against our own, which we do not know (docs/specs/015-api/public-api-and-tokens.md §6).
  onSelectionReleased?: (msg: { elementId: string; by: string }) => void;
  // Who follows us (docs/specs/012-collaboration/follow-me-viewport.md "Who follows whom"), by presence id. Sent to
  // this socket alone, on every change; emptied when a new socket opens, since nobody follows its new id yet.
  onFollowers?: (ids: string[]) => void;
  onClose?: () => void;
  // The document went to the Trash (docs/specs/013-workspace/trash.md): the room
  // closed this socket with DOCUMENT_TRASHED_CLOSE and will refuse every
  // reconnect, so the connector stops and says so, once.
  onDocumentTrashed?: () => void;
  // An access change ended this session (docs/specs/015-api/api.md "Access changes end the sessions
  // they affect"): a share password was set, or the member left the document's team. The room
  // closed it with ACCESS_CHANGED_CLOSE; the connector stops, and the caller reloads into the
  // ordinary access path (a password prompt, a refusal page, or the editor again).
  onAccessChanged?: () => void;
  // A workbench session's pairing or token ended (docs/specs/013-workspace/workbench-embeds.md): the
  // room closed it with WORKBENCH_ENDED_CLOSE; the connector stops and the page turns read-only.
  onWorkbenchEnded?: () => void;
  // The room refused to open this connection (it closed before ever opening): the join was turned away
  // at the upgrade, which the browser reports only as an abnormal close. The caller finds out why over
  // REST, which names a trashed document (docs/specs/013-workspace/trash.md). Retrying carries on as usual.
  onRefused?: () => void;
  // The room could not bridge our reconnect gap from its op log (docs/specs/012-collaboration/realtime-conflict-resolution.md,
  // Level 1): we're too far behind, or it restarted. The caller re-hydrates
  // from D1 (the same recovery the error boundary uses — a full reload).
  onResync?: () => void;
};

// connectRoom's options: the ticket that admits the socket, and how to mint a fresh one for a reconnect.
type RoomConnectOptions = {
  // One-time room ticket (docs/specs/015-api/api.md "Realtime model"), minted over authenticated REST via
  // apiCreateRoomTicket: the REST gates (the guest signature, the share code and its password, team
  // membership) all ran there, so the upgrade URL carries nothing but this. Null when the mint failed; the
  // upgrade is then refused and the reconnect mints again.
  ticket?: string | null;
  // A ticket is spent by the upgrade it admits (ws-tickets.ts deletes it), so a reconnect that sent the
  // first one again was refused, and the session lost the room for good. Called before every reconnect.
  mintTicket?: () => Promise<string | null>;
  // Who we follow, read at every (re)connect: the room keeps a follow on the socket, so a new socket says it again.
  readFollowing?: () => string | null;
};

// The room WebSocket's query string. Browsers can't set headers on a WebSocket upgrade, so whatever
// admits the socket rides the URL, and a URL is logged (edge logs, Logpush, tail). Only the ticket rides
// it: single-use, document-scoped and a minute long, so a logged one is already spent. The share code,
// the owner id, its signature and the share password used to ride here as `s`, `o`, `os` and `p`; they
// now go to the ticket mint as headers (docs/specs/015-api/api.md "Realtime model").
export function roomQueryString(ticket: string | null): string {
  return ticket ? new URLSearchParams({ t: ticket }).toString() : '';
}

// Reconnect backoff: a dropped socket auto-reopens so a brief network blip
// doesn't silently end a collaborative session. Capped attempts + capped
// delay so a hard-rejected upgrade (revoked share, lost membership) stops
// retrying rather than hammering the worker forever. Out of attempts, the
// connector waits for a sign the cause may have passed (the browser back
// online, the tab shown again: a laptop waking, wifi returning after the
// ~30 s the attempts span) and starts a fresh round then, so a longer outage
// no longer ends live collaboration for the rest of the session.
const MAX_RECONNECT_ATTEMPTS = 6;

// Ops held while the socket is down (docs/specs/012-collaboration/collab-race-hardening.md). A change made in that window
// used to be dropped on the floor: the save still carried it to D1, but no
// peer saw it until they reloaded, and a dot or an answer never reached the
// room's ledger at all. Only what changes the document is held: a
// cursor or a selection from a minute ago means nothing. Bounded, so a long
// outage can't grow it without end; past the bound, newer ops are dropped
// and the next save still carries the state to D1.
const OUTBOX_MAX = 500;
function isOutboxOp(msg: RoomOutgoing): boolean {
  if (msg.kind !== 'op') return false;
  const kind = (msg.op as { kind?: unknown }).kind;
  return isMutationOpKind(kind);
}
// How long a save waits for the room to say it sequenced a delta (docs/specs/012-collaboration/collab-race-hardening.md
// phase 6). A healthy room answers in one socket round trip, tens of milliseconds; past this the save
// goes ahead unconfirmed rather than hold the person's work back. Safe range: 500 ms to 10 s.
export const ROOM_SEQUENCE_ACK_TIMEOUT_MS = 2_000;
const RECONNECT_BASE_MS = 500;
// The keepalive (docs/specs/012-collaboration/realtime-conflict-resolution.md "Keepalive"). A socket can die
// without a close event (a laptop asleep, a NAT or proxy that dropped an idle connection): it reads OPEN while
// nothing arrives, so collaborators' changes silently stop until a reload. After ROOM_KEEPALIVE_IDLE_MS with
// nothing heard the client sends ROOM_PING, which the room's runtime answers without waking; a ping with no
// answer at all within ROOM_KEEPALIVE_TIMEOUT_MS ends the socket as a drop, and the reconnect takes over. Only an
// unanswered ping counts, never silence alone, so a background tab whose timers the browser slows to once a minute
// is never dropped for being quiet. Safe ranges: idle 10 s to 60 s, timeout 5 s to 30 s.
export const ROOM_KEEPALIVE_IDLE_MS = 20_000;
export const ROOM_KEEPALIVE_TIMEOUT_MS = 10_000;
const ROOM_KEEPALIVE_TICK_MS = 5_000;
const RECONNECT_MAX_MS = 15_000;

/** Who this client says it is to the room: the room overrides `id` (see connectRoom). */
type RoomSelf = { id: string; name: string; color: string };

export function connectRoom(
  documentId: string,
  // The room OVERRIDES `id` with its own per-socket presence id (docs/specs/015-api/public-api-and-tokens.md §6).
  participant: RoomSelf,
  handlers: RoomHandlers,
  options: RoomConnectOptions = {},
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
  // The latest selection and tab focus we told the room, said again on every new socket (see send).
  const lastSaid = new Map<string, RoomOutgoing>();
  let closed = false; // the caller called close() — never reconnect after that
  let opened = false; // we've had at least one successful session (→ reconnects sync)
  let attempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Out of attempts and waiting for the network or the tab to come back (see MAX_RECONNECT_ATTEMPTS).
  let parked = false;

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
      socketOpened = true;
      lastHeard = Date.now();
      keepalive = setInterval(checkAlive, ROOM_KEEPALIVE_TICK_MS);
      attempts = 0;
      socket.send(JSON.stringify({ kind: 'hello', participant } satisfies RoomOutgoing));
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
      try {
        const msg = JSON.parse(data) as RoomIncoming;
        if (msg.kind === 'presence') {
          settleTimings(true);
          const frame = splitPresenceFrame(msg);
          handlers.onPresence(frame.participants, frame.agents);
        } else if (msg.kind === 'selection-released') handlers.onSelectionReleased?.(msg);
        else if (msg.kind === 'followers') handlers.onFollowers?.(msg.ids);
        // The server release signal (docs/specs/016-platform/new-version-prompt.md, stale-builds.md).
        else if (msg.kind === 'format') {
          noteServerDocumentFormat(msg.format);
          noteServerBuild(msg.build);
        } else if (msg.kind === 'op') applyOp(msg.from, msg.op, msg.seq, msg.epoch);
        else if (msg.kind === 'cursor') {
          // Our own op's seq, or where the stream stood when we joined. A
          // different epoch is a restarted room: leave the cursor for the
          // sync / catchup exchange to reconcile.
          if (lastEpoch === null || lastEpoch === msg.epoch) {
            lastEpoch = msg.epoch;
            if (msg.seq > lastSeq) lastSeq = msg.seq;
          }
          if (msg.ref !== undefined) awaitingRef.get(msg.ref)?.(true);
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
      if (event?.code === WORKBENCH_ENDED_CLOSE) {
        closed = true;
        settleTimings(false);
        handlers.onWorkbenchEnded?.();
        return;
      }
      if (!socketOpened) handlers.onRefused?.();
      // A live session dropped by itself: time the outage until the roster is back.
      if (socketOpened && connectTiming === null)
        reconnectTiming ??= startEditorTiming('RoomReconnect');
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
    socket.addEventListener('close', onClose);
  };
  // A reconnect, with a fresh ticket: the room spends each one it admits.
  const reopen = async () => {
    reconnectTimer = null;
    if (options.mintTicket) {
      ticket = await options.mintTicket();
      if (closed) return;
    }
    open();
  };
  // Without a ticket in hand, the first socket waits for one; the connector exists meanwhile, so what
  // the editor says before the room opens (its selection, its tab) is kept and said on open.
  if (ticket === null && options.mintTicket) void reopen();
  else open();

  // A fresh round of attempts once the browser is back online or the tab is shown again, only while parked.
  const resume = () => {
    if (closed || !parked) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    parked = false;
    attempts = 0;
    debugLog('[room] reconnecting after a wait');
    void reopen();
  };
  if (typeof window !== 'undefined') window.addEventListener('online', resume);
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', resume);
  const stopResuming = () => {
    if (typeof window !== 'undefined') window.removeEventListener('online', resume);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', resume);
  };

  const send = (raw: RoomOutgoing) => {
    // No comment author id leaves this browser: it is its author's owner
    // id, a guest's credential, and the room hands every op to every socket
    // (docs/specs/012-collaboration/collab-race-hardening.md). One choke point for every send path.
    const msg: RoomOutgoing =
      raw.kind === 'op' ? { ...raw, op: opForTheWire(raw.op) as RoomOp } : raw;
    // State, not events: only the latest of each counts, so it is kept to say again on the next socket.
    if (msg.kind === 'op' && (msg.op.kind === 'select' || msg.op.kind === 'tab-focus')) {
      lastSaid.set(msg.op.kind, msg);
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
