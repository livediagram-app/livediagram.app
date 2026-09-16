'use client';

import { activeTimeline, initialTimelineOrigin, type Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// The timeline-lanes switch on an event-storming board (spec/139 Phase 6).
// Lanes are BOARD state, not a per-browser view preference: the facilitator
// turns them on for the room, so the answer lives on the tab (`esTimeline`)
// and travels with it through realtime, autosave, offline and export.
//
// The origin is chosen ONCE, from the board as it stands, and then kept for
// good — an off leaves it on the tab, so switching lanes off and on again
// cannot re-anchor the board to whatever note happens to be top-left by then.

type TimelineLanesDeps = {
  activeId: string;
  activeTab: Tab;
  // Is this an event-storming board? Lanes mean nothing anywhere else.
  esBoard: boolean;
  // A view-only session, a locked tab, or a tab still loading: the switch is
  // shown disabled rather than hidden, so a viewer can see the board HAS
  // lanes even though they cannot change that.
  editsBlocked: boolean;
  // Elements on a hidden or locked layer (spec/74): they cannot anchor the
  // lanes, because you cannot line a grid up with work you cannot see.
  layerInertIds: ReadonlySet<string>;
  commitTabs: (mapTabs: (ts: Tab[]) => Tab[]) => number;
  emitTabMeta: (tabId: string, summary: string) => void;
};

export type TimelineLanesApi = {
  // Are lanes on for the active tab right now?
  lanesOn: boolean;
  // May the switch be offered at all (an ES board), and may it be used?
  lanesAvailable: boolean;
  lanesDisabled: boolean;
  toggleLanes: () => void;
};

export function useTimelineLanes({
  activeId,
  activeTab,
  esBoard,
  editsBlocked,
  layerInertIds,
  commitTabs,
  emitTabMeta,
}: TimelineLanesDeps): TimelineLanesApi {
  const lanesOn = esBoard && activeTimeline(activeTab) !== null;

  const toggleLanes = () => {
    if (!esBoard || editsBlocked) return;
    const next = !lanesOn;
    // BEFORE the commit, the settings-flip precedent (spec/22): an event
    // reporting that something was turned off has to leave while the feature
    // that emits it is still on.
    track('Canvas', 'Used', next ? 'TimelineLanesOn' : 'TimelineLanesOff');
    commitTabs((ts) =>
      ts.map((t) => {
        if (t.id !== activeId) return t;
        // The origin is derived from the board only the FIRST time lanes come
        // on; after that the stored one is simply re-enabled.
        const origin = t.esTimeline ?? initialTimelineOrigin(t.elements, layerInertIds);
        return { ...t, esTimeline: { ...origin, enabled: next } };
      }),
    );
    emitTabMeta(activeId, next ? 'Turned timeline lanes on' : 'Turned timeline lanes off');
  };

  return {
    lanesOn,
    lanesAvailable: esBoard,
    lanesDisabled: editsBlocked,
    toggleLanes,
  };
}
