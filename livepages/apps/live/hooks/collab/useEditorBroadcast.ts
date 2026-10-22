// Outbound realtime traffic: throttled cursor + laser broadcasters
// and the local laser-trail buffer that feeds the on-screen overlay.
// Lifted out of editor-page.tsx so the page file stays focused on
// orchestration; the inbound side (the connectRoom + handlers
// effect) stays in editor-page for now because its handlers touch
// many setters scattered across the page (next slice on deck).
//
// Throttle: both broadcasters cap at ~30 Hz (33 ms between sends).
// That matches the cursor / laser packet rates the document-room
// Durable Object expects per docs/specs/015-api/api.md; faster sends would just be
// dropped on the wire.

import { useEffect, useRef, useState } from 'react';
import type { RoomOutgoing } from '@livepages/api-schema';
import type { CanvasTool } from '@/components/palette/palette.types';
import { trimLaserBuffer, type LaserPoint } from '@/lib/laser-buffer';
import type { LaserConfig } from '@/lib/laser-config';

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
  // so cursor / laser ops broadcast for it too.
  documentTeamId: string | null;
  // Which tab is currently active. Stamped on every cursor / laser
  // op so peers can filter trails by tab (a laser drawn on Tab 1
  // doesn't show on Tab 2).
  activeId: string;
  // Current canvas tool. The laser-trail buffer clears when the tool
  // switches away from 'laser' so a fresh laser session doesn't
  // start from a previous run's tail.
  canvasTool: CanvasTool;
};

type EditorBroadcastApi = {
  // Send the local cursor position (canvas-coords) to the room.
  // Pass `null` when the pointer leaves the canvas so peers can
  // hide the indicator.
  broadcastCursor: (pos: { x: number; y: number } | null) => void;
  // Append a laser point to the local trail AND broadcast it. The
  // local append happens unconditionally; the broadcast respects
  // the gate state + throttle. The overlay's RAF loop is what
  // makes trails visibly decay over the lifetime window.
  // `look` is the sender's pen (docs/specs/008-canvas/laser-panel.md); omitted by callers that have no
  // panel behind them, which draws the original laser.
  broadcastLaser: (x: number, y: number, look?: LaserConfig) => void;
  // Publish where we are looking (docs/specs/012-collaboration/follow-me-viewport.md), for anyone following us.
  broadcastViewport: (
    pan: { x: number; y: number },
    zoom: number,
    size: { width: number; height: number },
  ) => void;
  // The local trail buffer (canvas-coords + timestamps), consumed
  // by the LaserOverlay via the laserTrailRows aggregator in
  // editor-page.
  localLaserTrail: LaserPoint[];
};

export function useEditorBroadcast(deps: EditorBroadcastDeps): EditorBroadcastApi {
  const { activeId, canvasTool } = deps;
  const [localLaserTrail, setLocalLaserTrail] = useState<LaserPoint[]>([]);
  const lastCursorSentRef = useRef(0);
  // The cursor position a throttle window held back, sent when the window ends: the last move of a quick drag or
  // flick lands inside one, and dropping it left peers seeing the cursor parked short of where it stopped.
  const pendingCursorRef = useRef<{ x: number; y: number } | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLaserSentRef = useRef(0);
  useEffect(
    () => () => {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    },
    [],
  );
  const lastViewportSentRef = useRef(0);

  // Clear the local trail when leaving laser mode (or switching tabs)
  // so a partial path doesn't persist past the tool / tab change.
  // The overlay would eventually hide stale points via its LIFETIME
  // filter, but a fresh laser session shouldn't start from the prior
  // session's tail. Cleared during render, so the stale trail never
  // paints a frame. Unconditional: a tab switch with the laser tool
  // still active must clear too — the local trail carries no tabId, so
  // the overlay would ghost the old tab's path onto the new one for the
  // buffer TTL.
  const [trailFor, setTrailFor] = useState({ tool: canvasTool, tab: activeId });
  if (trailFor.tool !== canvasTool || trailFor.tab !== activeId) {
    setTrailFor({ tool: canvasTool, tab: activeId });
    setLocalLaserTrail([]);
  }

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

  const broadcastLaser = (x: number, y: number, look?: LaserConfig) => {
    const now = performance.now();
    // Throttle the LOCAL trail append (the setState) as well as the
    // network send — both at ~30 Hz. Beyond matching the wire rate, this
    // is the safety rail against a setState storm / render loop: if
    // broadcastLaser is somehow re-entered before the clock advances
    // (Maximum update depth), the throttle short-circuits every call
    // after the first in that window, so no further re-render is queued.
    // 30 Hz is plenty of resolution for a laser trail.
    if (now - lastLaserSentRef.current < BROADCAST_THROTTLE_MS) return;
    lastLaserSentRef.current = now;
    setLocalLaserTrail((prev) => trimLaserBuffer([...prev, { x, y, t: now }]));
    if (!deps.hydrated || !deps.documentId || (!deps.documentShareable && !deps.documentTeamId))
      return;
    deps.roomRef.current?.send({
      kind: 'op',
      // The pen rides the sample (docs/specs/008-canvas/laser-panel.md) so peers draw MY laser, not
      // their own default.
      op: { kind: 'laser', tabId: deps.activeId, x, y, ...(look ? { look } : {}) },
    });
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

  return {
    broadcastCursor,
    broadcastLaser,
    broadcastViewport,
    localLaserTrail,
  };
}
