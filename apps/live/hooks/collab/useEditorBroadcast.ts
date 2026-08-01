// Outbound realtime traffic: throttled cursor + laser + avatar broadcasters
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
import type { AvatarPresence, RoomOutgoing } from '@livediagram/api-schema';
import type { CanvasTool } from '@/components/palette/CommandPalette';
import { trimLaserBuffer, type LaserPoint } from '@/lib/laser-buffer';
import type { LaserConfig } from '@/lib/laser-config';

const BROADCAST_THROTTLE_MS = 33;
// The viewport (spec/131) publishes at ~10 Hz, a third of the cursor's rate: a
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
  // Vote privacy (spec/39): true while a hide-cursors vote is open on the
  // active tab. Cursor + laser ops stop going out entirely, so a peer
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
  // Append a laser point to the local trail AND broadcast it. The
  // local append happens unconditionally; the broadcast respects
  // the gate state + throttle. The overlay's RAF loop is what
  // makes trails visibly decay over the lifetime window.
  // `look` is the sender's pen (spec/111); omitted by callers that have no
  // panel behind them, which draws the original laser.
  broadcastLaser: (x: number, y: number, look?: LaserConfig) => void;
  // Publish the local Avatar-mode character (spec/101) to the room, or
  // `null` to tell peers to drop it. Throttled like the cursor.
  broadcastAvatar: (avatar: AvatarPresence | null) => void;
  // Ask one peer's character to step aside (spec/101): a unit direction and
  // who it is aimed at. Never throttled — it is an event, not a sample.
  broadcastAvatarPush: (targetId: string, dx: number, dy: number) => void;
  // Reaction pad (spec/135): tell the room a pad went off, so the burst plays
  // for everyone rather than only the person who pressed it.
  broadcastReaction: (elementId: string, reaction: string) => void;
  // Publish where we are looking (spec/131), for anyone following us.
  broadcastViewport: (pan: { x: number; y: number }, zoom: number) => void;
  // The local trail buffer (canvas-coords + timestamps), consumed
  // by the LaserOverlay via the laserTrailRows aggregator in
  // editor-page.
  localLaserTrail: LaserPoint[];
};

export function useEditorBroadcast(deps: EditorBroadcastDeps): EditorBroadcastApi {
  const [localLaserTrail, setLocalLaserTrail] = useState<LaserPoint[]>([]);
  const lastCursorSentRef = useRef(0);
  const lastLaserSentRef = useRef(0);
  const lastAvatarSentRef = useRef(0);
  const lastViewportSentRef = useRef(0);

  // Clear the local trail when leaving laser mode (or switching tabs)
  // so a partial path doesn't persist past the tool / tab change.
  // The overlay would eventually hide stale points via its LIFETIME
  // filter, but a fresh laser session shouldn't start from the prior
  // session's tail. Same behaviour as the inline effect this
  // replaced.
  useEffect(() => {
    // Unconditional: a tab switch with the laser tool still active must
    // clear too — the local trail carries no tabId, so the overlay would
    // ghost the old tab's path onto the new one for the buffer TTL.
    setLocalLaserTrail([]);
  }, [deps.canvasTool, deps.activeId]);

  // Entering a hide-cursors vote, retract our indicator once. Without
  // this, every peer keeps the LAST position we sent in their map: it's
  // suppressed while the vote runs, but the moment casting closes and the
  // render gate lifts, that frozen arrow re-appears pointing at whatever
  // we were looking at mid-vote — exactly the leak the mode exists to
  // prevent. A null cursor is the room's "pointer left the canvas" signal,
  // so peers drop the entry outright. Sent before the gate below applies.
  const cursorsHidden = deps.cursorsHidden;
  const roomRef = deps.roomRef;
  const activeId = deps.activeId;
  useEffect(() => {
    if (!cursorsHidden) return;
    roomRef.current?.send({
      kind: 'op',
      op: { kind: 'cursor', tabId: activeId, x: null, y: null },
    });
  }, [cursorsHidden, roomRef, activeId]);

  const broadcastCursor = (pos: { x: number; y: number } | null) => {
    if (deps.cursorsHidden) return;
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
    // Your own trail still draws locally (it's your own pointer); only the
    // outbound half is withheld while a hide-cursors vote is open.
    if (deps.cursorsHidden) return;
    if (!deps.hydrated || !deps.diagramId || (!deps.diagramShareable && !deps.diagramTeamId))
      return;
    deps.roomRef.current?.send({
      kind: 'op',
      // The pen rides the sample (spec/111) so peers draw MY laser, not
      // their own default.
      op: { kind: 'laser', tabId: deps.activeId, x, y, ...(look ? { look } : {}) },
    });
  };

  // Avatar mode (spec/101): publish the local character so peers can see it
  // walking. Same gate + throttle as the cursor, because it IS a cursor as far
  // as the wire is concerned. `null` (leaving the mode) always goes out
  // un-throttled, otherwise a peer keeps a ghost standing on their canvas.
  const broadcastAvatar = (avatar: AvatarPresence | null) => {
    if (deps.cursorsHidden) return;
    if (!deps.hydrated || !deps.diagramId || (!deps.diagramShareable && !deps.diagramTeamId))
      return;
    const now = performance.now();
    if (avatar && now - lastAvatarSentRef.current < BROADCAST_THROTTLE_MS) return;
    lastAvatarSentRef.current = now;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'avatar', tabId: deps.activeId, avatar },
    });
  };

  // Viewport (spec/131): where we are looking. Same presence gate as the
  // cursor — no room, no publish — on its own slower throttle.
  const broadcastViewport = (pan: { x: number; y: number }, zoom: number) => {
    if (deps.cursorsHidden) return;
    if (!deps.hydrated || !deps.diagramId || (!deps.diagramShareable && !deps.diagramTeamId))
      return;
    const now = performance.now();
    if (now - lastViewportSentRef.current < VIEWPORT_THROTTLE_MS) return;
    lastViewportSentRef.current = now;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'viewport', tabId: deps.activeId, pan, zoom },
    });
  };

  // One character shoving another (spec/101). A discrete event, so unlike the
  // avatar snapshot it is never throttled or dropped — but it rides the same
  // presence gate: no room, no push.
  const broadcastAvatarPush = (targetId: string, dx: number, dy: number) => {
    if (deps.cursorsHidden) return;
    if (!deps.hydrated || !deps.diagramId || (!deps.diagramShareable && !deps.diagramTeamId))
      return;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'avatar-push', tabId: deps.activeId, targetId, dx, dy },
    });
  };

  // A reaction burst (spec/135). Discrete like the shove above: never
  // throttled, never dropped, same presence gate.
  const broadcastReaction = (elementId: string, reaction: string) => {
    if (deps.cursorsHidden) return;
    if (!deps.hydrated || !deps.diagramId || (!deps.diagramShareable && !deps.diagramTeamId))
      return;
    deps.roomRef.current?.send({
      kind: 'op',
      op: { kind: 'reaction', tabId: deps.activeId, elementId, reaction },
    });
  };

  return {
    broadcastCursor,
    broadcastReaction,
    broadcastLaser,
    broadcastAvatar,
    broadcastAvatarPush,
    broadcastViewport,
    localLaserTrail,
  };
}
