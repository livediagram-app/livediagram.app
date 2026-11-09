// Outbound realtime traffic: throttled cursor + avatar broadcasters.
// Lifted out of editor-page.tsx so the page file stays focused on
// orchestration; the inbound side (the connectRoom + handlers
// effect) stays in editor-page for now because its handlers touch
// many setters scattered across the page (next slice on deck).
//
// Throttle: both broadcasters cap at ~30 Hz (33 ms between sends).
// That matches the cursor packet rates the document-room
// Durable Object expects per docs/specs/015-api/api.md; faster sends would just be
// dropped on the wire.

import { useCallback, useEffect, useRef } from 'react';
import type { AvatarPresence, RoomOutgoing } from '@livehuddle/api-schema';
import { avatarSendIntervalMs } from '@livehuddle/avatar/relay';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { CallSignal } from '@/lib/calls/proximity-call';

export const BROADCAST_THROTTLE_MS = 33;
// The viewport (docs/specs/012-collaboration/follow-me-viewport.md) publishes at ~10 Hz, a third of the cursor's rate: a
// camera is not a pointer, 10 Hz is smooth for a pan, and an idle participant
// sends nothing at all because this only fires on change.
const VIEWPORT_THROTTLE_MS = 100;

// Minimal shape of the room-handle the realtime effect stashes in a
// ref. We only need `send` here; the rest of the connectRoom API
// (close, listeners) is read elsewhere in editor-page.
type RoomHandle = { send: (msg: RoomOutgoing) => void };

type EditorBroadcastDeps = {
  // Ref carrying the live WS room handle (null before connect, null
  // after close). The hook reads through .current on every
  // broadcast so a reconnect doesn't require re-rendering the page.
  roomRef: React.RefObject<RoomHandle | null>;
  // Gate state. Broadcasts are no-ops until all three are true; the
  // realtime effect won't have opened the socket otherwise and we'd
  // be sending into the void.
  hydrated: boolean;
  documentId: string | null;
  documentShareable: boolean;
  // The document's team (docs/specs/013-workspace/team-shared-documents.md), null for a personal document. A team
  // document is a live room for its members even without a share link,
  // so cursor ops broadcast for it too.
  documentTeamId: string | null;
  // Which tab is currently active. Stamped on every cursor op so peers can
  // filter by tab.
  activeId: string;
  // How many people are in the room, us included. A busy room paces the character more slowly
  // (docs/specs/008-canvas/avatar-mode.md "A busy room").
  roomSize: number;
};

type EditorBroadcastApi = {
  // Send the local cursor position (canvas-coords) to the room.
  // Pass `null` when the pointer leaves the canvas so peers can
  // hide the indicator.
  broadcastCursor: (pos: { x: number; y: number } | null) => void;
  // Publish the local Avatar-mode character (docs/specs/008-canvas/avatar-mode.md) to the room, or
  // `null` to tell peers to drop it. Throttled like the cursor.
  broadcastAvatar: (avatar: AvatarPresence | null) => void;
  // Ask one peer's character to step aside (docs/specs/008-canvas/avatar-mode.md): a unit direction and
  // who it is aimed at. Never throttled — it is an event, not a sample.
  broadcastAvatarPush: (targetId: string, dx: number, dy: number) => void;
  // Say something (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"): one message, rising from `x, y`.
  // Never throttled (an event), held by the same gates as the push.
  broadcastAvatarSay: (say: { id: string; text: string; x: number; y: number }) => void;
  // Publish where we are looking (docs/specs/012-collaboration/follow-me-viewport.md), for anyone following us.
  broadcastViewport: (
    pan: { x: number; y: number },
    zoom: number,
    size: { width: number; height: number },
  ) => void;
  // Ask everyone else to come and look at a point (docs/specs/012-collaboration/bring-focus.md). Returns whether
  // it went out, so the presser can be told when nobody is listening rather
  // than watching a button do nothing.
  broadcastFocusHere: (at: { x: number; y: number }, zoom: number) => boolean;
  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The wire"): a talking level or this
  // browser's microphone locator, stamped with the active tab.
  broadcastCallSignal: (signal: CallSignal) => void;
  // Whether the room is open for this document, so a call has somebody to talk to.
  callsRoom: boolean;
};

export function useEditorBroadcast(deps: EditorBroadcastDeps): EditorBroadcastApi {
  const lastCursorSentRef = useRef(0);
  // The cursor position a throttle window held back, sent when the window ends: the last move of a quick drag or
  // flick lands inside one, and dropping it left peers seeing the cursor parked short of where it stopped.
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAvatarSentRef = useRef(0);
  // The packet a throttle window held back, sent when the window ends, so the last thing said (a status picked, the
  // step a walk ends on) is never the one dropped.
  const pendingAvatarRef = useRef<AvatarPresence | null>(null);
  const avatarTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (avatarTimerRef.current) clearTimeout(avatarTimerRef.current);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    },
    [],
  );
  const lastViewportSentRef = useRef(0);

  const broadcastCursor = (pos: { x: number; y: number } | null) => {
    if (!deps.hydrated || !deps.documentId || (!deps.documentShareable && !deps.documentTeamId))
      return;
    const send = (at: { x: number; y: number } | null) => {
      lastCursorSentRef.current = performance.now();
      deps.roomRef.current?.send({
        kind: 'op',
        op: { kind: 'cursor', tabId: deps.activeId, x: at?.x ?? null, y: at?.y ?? null },
      });
    };
    const wait = BROADCAST_THROTTLE_MS - (performance.now() - lastCursorSentRef.current);
    if (pos && wait > 0) {
      pendingCursorRef.current = pos;
      cursorTimerRef.current ??= setTimeout(() => {
        cursorTimerRef.current = null;
        const pending = pendingCursorRef.current;
        pendingCursorRef.current = null;
        if (pending) send(pending);
      }, wait);
      return;
    }
    // Sent now (or the pointer left): nothing held back is still true.
    pendingCursorRef.current = null;
    if (cursorTimerRef.current) {
      clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    }
    send(pos);
  };

  // Avatar mode (docs/specs/008-canvas/avatar-mode.md): publish the local character so peers can see it
  // walking. Same gate + throttle as the cursor, because it IS a cursor as far
  // as the wire is concerned. `null` (leaving the mode) always goes out
  // un-throttled, otherwise a peer keeps a ghost standing on their canvas.
  const broadcastAvatar = (avatar: AvatarPresence | null) => {
    if (!deps.hydrated || !deps.documentId || (!deps.documentShareable && !deps.documentTeamId))
      return;
    const now = performance.now();
    const send = (packet: AvatarPresence | null) => {
      lastAvatarSentRef.current = performance.now();
      deps.roomRef.current?.send({
        kind: 'op',
        op: { kind: 'avatar', tabId: deps.activeId, avatar: packet },
      });
    };
    // Stepped down in a busy room: every 33 ms up to 10 people, 50 up to 32, 66 above.
    const wait = avatarSendIntervalMs(deps.roomSize) - (now - lastAvatarSentRef.current);
    if (avatar && wait > 0) {
      pendingAvatarRef.current = avatar;
      avatarTimerRef.current ??= setTimeout(() => {
        avatarTimerRef.current = null;
        const pending = pendingAvatarRef.current;
        pendingAvatarRef.current = null;
        if (pending) send(pending);
      }, wait);
      return;
    }
    // Sent now (or leaving the mode): nothing held back is still true.
    pendingAvatarRef.current = null;
    if (avatarTimerRef.current) {
      clearTimeout(avatarTimerRef.current);
      avatarTimerRef.current = null;
    }
    send(avatar);
  };

  // Viewport (docs/specs/012-collaboration/follow-me-viewport.md): where we are looking. Same presence gate as the
  // cursor — no room, no publish — on its own slower throttle.
  const broadcastViewport = (
    pan: { x: number; y: number },
    zoom: number,
    size: { width: number; height: number },
  ) => {
    if (!deps.hydrated || !deps.documentId || (!deps.documentShareable && !deps.documentTeamId))
      return;
    const now = performance.now();
    if (now - lastViewportSentRef.current < VIEWPORT_THROTTLE_MS) return;
    lastViewportSentRef.current = now;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'viewport', tabId: deps.activeId, pan, zoom, size },
    });
  };

  // "Come and look at this" (docs/specs/012-collaboration/bring-focus.md). A discrete event like the shove below:
  // never throttled, because there is only ever one of them per press, and
  // dropping it would silently do nothing to the room.
  //
  // Returns whether it went out, so the presser can be told when they are the
  // only one here rather than watching a button do nothing.
  const broadcastFocusHere = (at: { x: number; y: number }, zoom: number): boolean => {
    if (!deps.hydrated || !deps.documentId || (!deps.documentShareable && !deps.documentTeamId))
      return false;
    const room = deps.roomRef.current;
    if (!room) return false;
    room.send({ kind: 'op', op: { kind: 'focus-here', tabId: deps.activeId, at, zoom } });
    return true;
  };

  // One character shoving another (docs/specs/008-canvas/avatar-mode.md). A discrete event, so unlike the
  // avatar snapshot it is never throttled or dropped — but it rides the same
  // presence gate: no room, no push.
  const broadcastAvatarPush = (targetId: string, dx: number, dy: number) => {
    if (!deps.hydrated || !deps.documentId || (!deps.documentShareable && !deps.documentTeamId))
      return;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'avatar-push', tabId: deps.activeId, targetId, dx, dy },
    });
  };

  // A speech bubble (docs/specs/008-canvas/avatar-mode.md "Speech bubbles"). Discrete like the shove above:
  // never throttled, same presence gate.
  const broadcastAvatarSay = (say: { id: string; text: string; x: number; y: number }) => {
    if (!deps.hydrated || !deps.documentId || (!deps.documentShareable && !deps.documentTeamId))
      return;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'avatar-say', tabId: deps.activeId, ...say },
    });
  };

  // Proximity audio (docs/specs/012-collaboration/proximity-audio.md "The wire"): discrete like the push, paced
  // by the call itself (a level at most four times a second, a locator at most once a second).
  const callsRoom =
    deps.hydrated && !!deps.documentId && (deps.documentShareable || !!deps.documentTeamId);
  // One function for the life of the editor, reading the room and the tab when it sends: the knocker and the bell
  // ringer are registered against it, and a new one each render re-registered them (and woke every Room Sign) on
  // every render of the canvas host.
  const callSignalRef = useLatest({ callsRoom, roomRef: deps.roomRef, activeId: deps.activeId });
  const broadcastCallSignal = useCallback(
    (signal: CallSignal) => {
      const { callsRoom: open, roomRef, activeId } = callSignalRef.current;
      if (!open) return;
      roomRef.current?.send({ kind: 'op', op: { ...signal, tabId: activeId } });
    },
    [callSignalRef],
  );

  return {
    broadcastCallSignal,
    callsRoom,
    broadcastCursor,
    broadcastAvatar,
    broadcastAvatarPush,
    broadcastAvatarSay,
    broadcastViewport,
    broadcastFocusHere,
  };
}
