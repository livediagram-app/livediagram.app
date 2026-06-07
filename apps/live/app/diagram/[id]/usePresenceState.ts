import { useEffect, useRef, useState } from 'react';
import type { Participant } from '@/lib/identity';
import type { LaserPoint } from '@/lib/laser-buffer';

// Realtime presence state for the diagram room: who's connected, each
// peer's last-seen timestamp, and their tab focus / selection / cursor /
// laser trail. useRoomConnection writes these through the returned
// setters; useEditorState reads them (via lib/presence-rows) to build the
// avatar / cursor / laser / selection rows the editor renders.
export function usePresenceState() {
  // Live presence: the participants connected to this diagram's
  // Durable Object room right now. Includes ourselves once our `hello`
  // round-trips. Rendered in the editor header avatar stack.
  const [livePresence, setLivePresence] = useState<Participant[]>([]);
  // Wall-clock timestamp of each peer's last observed interaction.
  // Seeded on presence arrival; bumped on every incoming op from
  // that peer (cursor / selection / tab op). Drives the
  // online/away/offline derivation + the "Active X ago" tooltip.
  // Lives in a ref because the bump-on-op needs to be O(1) and we
  // don't want to re-render the whole tree on every cursor packet
  // just to update an idle timestamp.
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  // Re-derive presence statuses on a 30s tick. Without this, a peer
  // who fell idle would keep showing "online" until something else
  // re-rendered the editor.
  const [, setIdleTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdleTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  // Which tab each remote participant is currently looking at. Driven
  // by the room's 'tab-focus' op; updated on every active-tab change
  // and on initial room connect. Used to render avatar dots on the
  // matching TabBar entries so collaborators can see at a glance
  // where everyone is working.
  const [remoteTabFocus, setRemoteTabFocus] = useState<Map<string, string>>(new Map());
  // Per-participant selection: which element each remote participant
  // currently has focused (null means deselected). Cleared for any
  // participant who drops out of presence. Drives the on-element badges
  // in BoxedElementView so users can see in real time what others are
  // working on.
  const [remoteSelections, setRemoteSelections] = useState<Map<string, string | null>>(new Map());
  // Live cursor positions for every remote participant. Stored in
  // canvas-coords (pre-transform) so they pan / zoom correctly with
  // the canvas. `null` cursor means the participant moved off the
  // canvas surface; we keep the entry around (vs deleting) so the
  // last-seen position can still inform analytics later if needed.
  const [remoteCursors, setRemoteCursors] = useState<
    Map<string, { tabId: string; x: number; y: number } | null>
  >(new Map());
  // Per-participant laser-pointer trails, keyed by participant id.
  // Each entry is a buffer of recent points; the LaserOverlay filters
  // them by age and renders the fading line. Trail buffers are
  // bounded both by time (LIFETIME_MS in the overlay) and by a hard
  // cap of 60 points in the receive handler so a flood can't grow the
  // buffer without bound. Scoped per tab in the op itself.
  const [remoteLaserTrails, setRemoteLaserTrails] = useState<
    Map<string, { tabId: string; points: LaserPoint[] }>
  >(new Map());

  return {
    livePresence,
    setLivePresence,
    lastSeenRef,
    remoteTabFocus,
    setRemoteTabFocus,
    remoteSelections,
    setRemoteSelections,
    remoteCursors,
    setRemoteCursors,
    remoteLaserTrails,
    setRemoteLaserTrails,
  };
}
