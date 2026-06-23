// Outbound realtime traffic: throttled cursor + laser broadcasters
// and the local laser-trail buffer that feeds the on-screen overlay.
// Lifted out of editor-page.tsx so the page file stays focused on
// orchestration; the inbound side (the connectRoom + handlers
// effect) stays in editor-page for now because its handlers touch
// many setters scattered across the page (next slice on deck).
//
// Throttle: both broadcasters cap at ~30 Hz (33 ms between sends).
// That matches the cursor / laser packet rates the diagram-room
// Durable Object expects per spec/11; faster sends would just be
// dropped on the wire.

import { useEffect, useRef, useState } from 'react';
import type { RoomOutgoing } from '@livediagram/api-schema';
import type { CanvasTool } from '@/components/CommandPalette';
import { trimLaserBuffer, type LaserPoint } from '@/lib/laser-buffer';

const BROADCAST_THROTTLE_MS = 33;

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
  diagramId: string | null;
  diagramShareable: boolean;
  // The diagram's team (spec/35), null for a personal diagram. A team
  // diagram is a live room for its members even without a share link,
  // so cursor / laser ops broadcast for it too.
  diagramTeamId: string | null;
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
  broadcastLaser: (x: number, y: number) => void;
  // The local trail buffer (canvas-coords + timestamps), consumed
  // by the LaserOverlay via the laserTrailRows aggregator in
  // editor-page.
  localLaserTrail: LaserPoint[];
};

export function useEditorBroadcast(deps: EditorBroadcastDeps): EditorBroadcastApi {
  const [localLaserTrail, setLocalLaserTrail] = useState<LaserPoint[]>([]);
  const lastCursorSentRef = useRef(0);
  const lastLaserSentRef = useRef(0);

  // Clear the local trail when leaving laser mode (or switching tabs)
  // so a partial path doesn't persist past the tool / tab change.
  // The overlay would eventually hide stale points via its LIFETIME
  // filter, but a fresh laser session shouldn't start from the prior
  // session's tail. Same behaviour as the inline effect this
  // replaced.
  useEffect(() => {
    if (deps.canvasTool !== 'laser') {
      setLocalLaserTrail([]);
    }
  }, [deps.canvasTool, deps.activeId]);

  const broadcastCursor = (pos: { x: number; y: number } | null) => {
    if (!deps.hydrated || !deps.diagramId || (!deps.diagramShareable && !deps.diagramTeamId))
      return;
    const now = performance.now();
    if (pos && now - lastCursorSentRef.current < BROADCAST_THROTTLE_MS) return;
    lastCursorSentRef.current = now;
    deps.roomRef.current?.send({
      kind: 'op',
      op: {
        kind: 'cursor',
        tabId: deps.activeId,
        x: pos?.x ?? null,
        y: pos?.y ?? null,
      },
    });
  };

  const broadcastLaser = (x: number, y: number) => {
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
    if (!deps.hydrated || !deps.diagramId || (!deps.diagramShareable && !deps.diagramTeamId))
      return;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'laser', tabId: deps.activeId, x, y },
    });
  };

  return { broadcastCursor, broadcastLaser, localLaserTrail };
}
