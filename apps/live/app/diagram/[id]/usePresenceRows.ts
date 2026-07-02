// Derived presence rows for the editor render, lifted out of
// useEditorState. Wraps the pure builders in lib/presence-rows with
// the memoisation + the live state they join over (usePresenceState
// values, the local laser trail, the active tab). Pure derivation:
// no handlers, no setters, nothing here mutates state.

import { useCallback, useMemo, type MutableRefObject } from 'react';
import type { Tab } from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import type { LaserPoint } from '@/lib/laser-buffer';
import {
  buildLaserTrailRows,
  buildParticipantsByTab,
  buildRemoteCursorRows,
  buildRemoteSelectionsByElement,
  type RemoteSelection,
} from '@/lib/presence-rows';

type PresenceRowsDeps = {
  diagramShareable: boolean;
  diagramTeamId: string | null;
  activeId: string;
  selfParticipant: Participant;
  tabs: Tab[];
  // Everything below comes from usePresenceState / useEditorBroadcast.
  livePresence: Participant[];
  lastSeenRef: MutableRefObject<Map<string, number>>;
  remoteTabFocus: Map<string, string>;
  remoteCursors: Map<string, { tabId: string; x: number; y: number } | null>;
  remoteSelections: Map<string, RemoteSelection>;
  remoteLaserTrails: Map<string, { tabId: string; points: LaserPoint[] }>;
  localLaserTrail: LaserPoint[];
};

export function usePresenceRows(deps: PresenceRowsDeps) {
  const {
    diagramShareable,
    diagramTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    lastSeenRef,
    remoteTabFocus,
    remoteCursors,
    remoteSelections,
    remoteLaserTrails,
    localLaserTrail,
  } = deps;

  // Per-element remote-selection map. Looks up each participant id
  // against the current `livePresence` so we can render their colour +
  // initials without bringing the participant blob along in every
  // `select` op. Self is filtered out: we don't need a "you're here"
  // badge on top of our own selection ring.
  const livePresenceById = useMemo(
    () => new Map(livePresence.map((p) => [p.id, p] as const)),
    [livePresence],
  );
  // Group participants by the tab they're currently focused on, so
  // each TabBar entry can render the right avatar dots. Always
  // includes the local participant on their active tab; that way
  // the feature is visible even for solo / unshared sessions, and
  // remote peers see their own dot pop onto the tab they switch to
  // before any pointer movement. Remote entries come from the
  // tab-focus RoomOp; only those whose sender is still present
  // (livePresence has them) survive.
  //
  // Status is per-viewer: a participant on the viewer's active tab
  // is 'online' (green ring), a participant on any other tab is
  // 'away' (orange ring). Cheap signal that someone's not where you
  // are right now without leaving the TabBar.
  //
  // Deliberately not memoised: it reads Date.now() + lastSeenRef so
  // each render re-derives fresh idle statuses (the presence-state
  // 30s tick drives the periodic refresh).
  const participantsByTab = buildParticipantsByTab({
    diagramShareable,
    diagramTeamId,
    activeId,
    selfParticipant,
    tabs,
    remoteTabFocus,
    livePresence,
    livePresenceById,
    lastSeen: lastSeenRef.current,
    now: Date.now(),
  });
  // Cursor rows joined with presence so we get a fresh colour + name on
  // every render and don't have to denormalise them into each `cursor`
  // op payload. Filter to the active tab so cursors of teammates
  // looking at a different tab don't bleed onto this one.
  const remoteCursorRows = useMemo(
    () => buildRemoteCursorRows(remoteCursors, livePresenceById, selfParticipant.id, activeId),
    [remoteCursors, livePresenceById, selfParticipant.id, activeId],
  );
  // Laser trails for the LaserOverlay: local first, then any peers
  // whose latest sample is on the active tab and whose participant
  // entry is still live. The overlay handles fade + cleanup; we just
  // assemble per-tab visibility here.
  const laserTrailRows = useMemo(
    () =>
      buildLaserTrailRows({
        localLaserTrail,
        remoteLaserTrails,
        livePresenceById,
        selfId: selfParticipant.id,
        selfColor: selfParticipant.color,
        activeId,
      }),
    [
      localLaserTrail,
      remoteLaserTrails,
      livePresenceById,
      selfParticipant.id,
      selfParticipant.color,
      activeId,
    ],
  );
  const remoteSelectionsByElement = useMemo(
    () =>
      buildRemoteSelectionsByElement(
        remoteSelections,
        livePresenceById,
        selfParticipant.id,
        activeId,
      ),
    [remoteSelections, livePresenceById, selfParticipant.id, activeId],
  );
  // Concurrent-selection lock (spec/07): an element another participant
  // has selected is off-limits to the local user. buildRemoteSelections-
  // ByElement already filters out our own selection, so a hit here always
  // means someone ELSE holds it. The selection hooks consult this to block
  // select / edit / marquee; the element view uses it for the cursor +
  // "Locked to <name>" tooltip.
  const lockedByOther = useCallback(
    (id: string) => remoteSelectionsByElement.has(id),
    [remoteSelectionsByElement],
  );

  return {
    livePresenceById,
    participantsByTab,
    remoteCursorRows,
    laserTrailRows,
    remoteSelectionsByElement,
    lockedByOther,
  };
}
