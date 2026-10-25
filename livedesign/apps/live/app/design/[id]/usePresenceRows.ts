// Derived presence rows for the editor render, lifted out of
// useEditorState. Wraps the pure builders in lib/presence-rows with
// the memoisation + the live state they join over (usePresenceState
// values, the local laser trail, the active tab). Pure derivation:
// no handlers, no setters, nothing here mutates state.

import { useCallback, useMemo } from 'react';
import {
  useLocalBesideTab,
  useRemoteBesideTabs,
} from '@liveworkspace/workbench/lib/split-presence';
import type { Tab } from '@livedesign/design';
import type { Participant } from '@/lib/identity';
import type { PresenceClock } from './usePresenceState';
import type { LaserPoint } from '@/lib/laser-buffer';
import type { LaserConfig } from '@/lib/laser-config';
import type { AgentPresence } from '@livedesign/api-schema';
import { buildAgentFocusByElement, foldAgentPresence } from '@/lib/agent-presence-rows';
import {
  buildLaserTrailRows,
  buildParticipantsByTab,
  buildRemoteCursorRows,
  buildRemoteSelectionsByElement,
  type RemoteSelection,
} from '@/lib/presence-rows';

type PresenceRowsDeps = {
  designShareable: boolean;
  designTeamId: string | null;
  activeId: string;
  selfParticipant: Participant;
  tabs: Tab[];
  // Everything below comes from usePresenceState / useEditorBroadcast.
  livePresence: Participant[];
  // Agents present in the room (docs/specs/024-agents/agent-presence.md), folded into the tab rows.
  liveAgents: AgentPresence[];
  presenceClock: PresenceClock;
  remoteTabFocus: Map<string, string>;
  remoteCursors: Map<string, { tabId: string; x: number; y: number } | null>;
  remoteSelections: Map<string, RemoteSelection>;
  remoteLaserTrails: Map<string, { tabId: string; points: LaserPoint[] }>;
  localLaserTrail: LaserPoint[];
  // The local participant's laser pen (docs/specs/008-canvas/laser-panel.md).
  selfLaserConfig?: LaserConfig;
};

export function usePresenceRows(deps: PresenceRowsDeps) {
  const {
    designShareable,
    designTeamId,
    activeId,
    selfParticipant,
    tabs,
    livePresence,
    liveAgents,
    presenceClock,
    remoteTabFocus,
    remoteCursors,
    remoteSelections,
    remoteLaserTrails,
    localLaserTrail,
    // Our own pen (docs/specs/008-canvas/laser-panel.md): peers' arrive with their samples, ours is read
    // from state so our trail never lags a change we just made.
    selfLaserConfig,
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
  // Statuses derive from the presence clock (usePresenceState): its tick moves idle peers to away, and a
  // returning peer's first op moves them back at once.
  // Agents fold in after (docs/specs/024-agents/agent-presence.md "In the editor"): their status lines on their
  // owners' rows, or rows of their own; a personal design's stack shows while one is present.
  // Side by side (docs/specs/007-editor/split-view.md "Presence"): the tab in each person's other pane.
  const remoteBesideTabs = useRemoteBesideTabs();
  const selfBesideTabId = useLocalBesideTab();
  const participantsByTab = foldAgentPresence({
    participantsByTab: buildParticipantsByTab({
      designShareable,
      designTeamId,
      agentsPresent: liveAgents.length > 0,
      activeId,
      selfParticipant,
      tabs,
      remoteTabFocus,
      remoteBesideTabs,
      selfBesideTabId,
      livePresence,
      livePresenceById,
      lastSeen: presenceClock.lastSeen,
      now: presenceClock.now,
    }),
    agents: liveAgents,
    selfParticipant,
    activeId,
    tabIds: tabs.map((tab) => tab.id),
    now: presenceClock.now,
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
        selfLaserConfig,
      }),
    [
      localLaserTrail,
      remoteLaserTrails,
      livePresenceById,
      selfParticipant.id,
      selfParticipant.color,
      activeId,
      selfLaserConfig,
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
  // What each agent names in focus on the active tab, for the focus rings. Never part of the lock below: an agent
  // holds nothing.
  const activeTab = tabs.find((tab) => tab.id === activeId);
  const agentFocusByElement = useMemo(
    () =>
      buildAgentFocusByElement(
        liveAgents,
        activeId,
        new Set((activeTab?.elements ?? []).map((element) => element.id)),
      ),
    [liveAgents, activeId, activeTab],
  );
  // Concurrent-selection lock (docs/specs/007-editor/live-app.md): an element another participant
  // has selected is off-limits to the local user. buildRemoteSelections-
  // ByElement already filters out our own selection, so a hit here always
  // means someone ELSE holds it. The selection hooks consult this to block
  // select / edit / marquee; the element view uses it for the cursor +
  // "Locked to <name>" hover card.
  const lockedByOther = useCallback(
    (id: string) => remoteSelectionsByElement.get(id)?.some((s) => s.holds) ?? false,
    [remoteSelectionsByElement],
  );

  return {
    livePresenceById,
    participantsByTab,
    remoteCursorRows,
    laserTrailRows,
    remoteSelectionsByElement,
    agentFocusByElement,
    lockedByOther,
  };
}
