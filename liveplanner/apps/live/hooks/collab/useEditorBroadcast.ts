// Outbound realtime traffic: the throttled cursor broadcaster.
// Lifted out of editor-page.tsx so the page file stays focused on
// orchestration; the inbound side (the connectRoom + handlers
// effect) stays in editor-page for now because its handlers touch
// many setters scattered across the page (next slice on deck).
//
// Throttle: the broadcaster caps at ~30 Hz (33 ms between sends).
// That matches the cursor packet rate the project-room
// Durable Object expects per docs/specs/015-api/api.md; faster sends would just be
// dropped on the wire.

import { useEffect, useRef } from 'react';
import type { RoomOutgoing } from '@liveplanner/api-schema';

export const BROADCAST_THROTTLE_MS = 33;

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
  projectId: string | null;
  projectShareable: boolean;
  // The project's team (docs/specs/013-workspace/team-shared-projects.md), null for a personal project. A team
  // project is a live room for its members even without a share link,
  // so cursor ops broadcast for it too.
  projectTeamId: string | null;
  // Which tab is currently active. Stamped on every cursor op so peers
  // can filter cursors by tab.
  activeId: string;
  // Vote privacy (docs/specs/012-collaboration/session-tools.md): true while a hide-cursors vote is open on the
  // active tab. Cursor ops stop going out entirely, so a peer
  // can't read positions off the socket even with devtools open — a
  // render-only gate would leave the coordinates on the wire. The
  // matching render gate lives in usePresenceRows.
  cursorsHidden: boolean;
};

type EditorBroadcastApi = {
  // Send the local cursor position (canvas-coords) to the room.
  // Pass `null` when the pointer leaves the canvas so peers can
  // hide the indicator.
  broadcastCursor: (pos: { x: number; y: number } | null) => void;
};

export function useEditorBroadcast(deps: EditorBroadcastDeps): EditorBroadcastApi {
  const { roomRef, cursorsHidden, activeId } = deps;
  const lastCursorSentRef = useRef(0);
  // The cursor position a throttle window held back, sent when the window ends: the last move of a quick drag or
  // flick lands inside one, and dropping it left peers seeing the cursor parked short of where it stopped.
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    },
    [],
  );
  // Entering a hide-cursors vote, retract our indicator once. Without
  // this, every peer keeps the LAST position we sent in their map: it's
  // suppressed while the vote runs, but the moment casting closes and the
  // render gate lifts, that frozen arrow re-appears pointing at whatever
  // we were looking at mid-vote — exactly the leak the mode exists to
  // prevent. A null cursor is the room's "pointer left the canvas" signal,
  // so peers drop the entry outright. Sent before the gate below applies.
  useEffect(() => {
    if (!cursorsHidden) return;
    // A position held back for the end of a throttle window must not follow the retraction.
    pendingCursorRef.current = null;
    if (cursorTimerRef.current) {
      clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
    }
    roomRef.current?.send({
      kind: 'op',
      op: { kind: 'cursor', tabId: activeId, x: null, y: null },
    });
  }, [cursorsHidden, roomRef, activeId]);

  const broadcastCursor = (pos: { x: number; y: number } | null) => {
    if (deps.cursorsHidden) return;
    if (!deps.hydrated || !deps.projectId || (!deps.projectShareable && !deps.projectTeamId))
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

  return { broadcastCursor };
}
