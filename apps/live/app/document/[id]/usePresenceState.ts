import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentPresence, AvatarPresence } from '@livediagram/api-schema';
import type { RemoteSelection } from '@/lib/presence-rows';
import { AWAY_AFTER_MS, type Participant } from '@/lib/identity';
import { RELATIVE_TICK_MS } from '@/lib/relative-time';

// What presence statuses render from: each peer's last-seen instant and the clock they are read at.
export type PresenceClock = { now: number; lastSeen: ReadonlyMap<string, number> };
import type { LaserPoint } from '@/lib/laser-buffer';

// Realtime presence state for the document room: who's connected, each
// peer's last-seen timestamp, and their tab focus / selection / cursor /
// laser trail / walking character (docs/specs/008-canvas/avatar-mode.md). useRoomConnection writes these through the returned
// setters; useEditorState reads them (via lib/presence-rows) to build the
// avatar / cursor / laser / selection rows the editor renders.
export function usePresenceState() {
  // Live presence: the participants connected to this document's
  // Durable Object room right now. Includes ourselves once our `hello`
  // round-trips. Rendered in the editor header avatar stack.
  const [livePresence, setLivePresence] = useState<Participant[]>([]);
  // Agents present in the room (docs/specs/024-agents/agent-presence.md), apart from the sessions: they are
  // folded into the tab rows, never counted as people.
  const [liveAgents, setLiveAgents] = useState<AgentPresence[]>([]);
  // Wall-clock timestamp of each peer's last observed interaction: seeded on presence arrival, bumped on
  // every incoming op (cursor / selection / tab). The bump lands in a ref, because re-rendering the tree
  // on every cursor packet just to move an idle timestamp would be wasteful. Render never reads the ref:
  // it reads `presenceClock`, a snapshot the idle tick republishes every 30s (so a peer who falls idle
  // turns away without anything else re-rendering), and that a bump republishes at once when a peer
  // arrives or returns from idle (so they turn online immediately).
  // (docs/specs/003-system-architecture/react-state-and-effects.md)
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const [presenceClock, setPresenceClock] = useState<PresenceClock>(() => ({
    now: Date.now(),
    lastSeen: new Map(),
  }));
  const publish = useCallback(
    () => setPresenceClock({ now: Date.now(), lastSeen: new Map(lastSeenRef.current) }),
    [],
  );
  useEffect(() => {
    const id = window.setInterval(publish, RELATIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, [publish]);
  const markSeen = useCallback(
    (participantId: string) => {
      const at = Date.now();
      const prev = lastSeenRef.current.get(participantId);
      lastSeenRef.current.set(participantId, at);
      if (prev === undefined || at - prev >= AWAY_AFTER_MS) publish();
    },
    [publish],
  );
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
  const [remoteSelections, setRemoteSelections] = useState<Map<string, RemoteSelection>>(new Map());
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
  // Per-participant Avatar-mode characters (docs/specs/008-canvas/avatar-mode.md), keyed by participant
  // id: the latest presence snapshot each peer published, or absent once they
  // leave the mode (an `avatar: null` op deletes the entry). Scoped per tab in
  // the op itself, like cursors.
  // Follow-me (docs/specs/012-collaboration/follow-me-viewport.md): where each peer is looking. Unsolicited, so it is
  // collected for everyone and read only while somebody is being followed.
  const [remoteViewports, setRemoteViewports] = useState<
    Map<string, { tabId: string; pan: { x: number; y: number }; zoom: number }>
  >(new Map());
  const [remoteAvatars, setRemoteAvatars] = useState<
    Map<string, { tabId: string; avatar: AvatarPresence }>
  >(new Map());

  return {
    livePresence,
    setLivePresence,
    liveAgents,
    setLiveAgents,
    lastSeenRef,
    presenceClock,
    markSeen,
    remoteTabFocus,
    setRemoteTabFocus,
    remoteSelections,
    setRemoteSelections,
    remoteCursors,
    setRemoteCursors,
    remoteLaserTrails,
    setRemoteLaserTrails,
    remoteAvatars,
    remoteViewports,
    setRemoteViewports,
    setRemoteAvatars,
  };
}
