import { useEffect, useRef } from 'react';
import { isEventStormingTab, settleNotesOnLanes, type Tab } from '@livediagram/diagram';
import { track } from '@/lib/telemetry';

// The one-time settle of an older event-storming board
// (docs/specs/021-event-storming/event-storming.md "Always on a lane"). A board authored before lanes held notes can
// have workshop notes parked between lanes. The first time it is opened by
// someone who can edit it, they move to their nearest lane in ONE undoable
// step, and the board is marked so it never happens again: a note free-placed
// afterwards (Cmd/Ctrl) stays where it was put.
//
// The mark survives undo (graftLiveTabState): undoing the settle is the
// author saying no, and the board must not ask again. Within a session the
// hook also remembers every tab it has settled, so the render that follows an
// undo cannot run it a second time before the graft has landed.

export function settleToast(count: number): string {
  return `Lined up ${count} ${count === 1 ? 'note' : 'notes'} on the lanes.`;
}

export function useLaneSettle(deps: {
  activeTab: Tab;
  // A view-only session, a locked tab, or a tab whose content is not loaded
  // yet: nothing may be written, and a half-loaded tab must not be marked.
  editsBlocked: boolean;
  // One undoable step on the active tab, with its activity-log diff.
  commitActiveTab: (mapTab: (t: Tab) => Tab) => void;
  // Set the mark without an undo step (a board with nothing to move).
  markSettled: (tabId: string) => void;
  toastInfo: (message: string) => void;
}): void {
  const { activeTab, editsBlocked } = deps;
  const settledRef = useRef(new Set<string>());
  const depsRef = useRef(deps);
  useEffect(() => {
    depsRef.current = deps;
  });

  useEffect(() => {
    if (editsBlocked || !isEventStormingTab(activeTab) || activeTab.esLanesSettled === true) return;
    if (settledRef.current.has(activeTab.id)) return;
    settledRef.current.add(activeTab.id);
    const { movedIds } = settleNotesOnLanes(activeTab.elements);
    const d = depsRef.current;
    if (movedIds.length === 0) {
      d.markSettled(activeTab.id);
      console.debug('[es-lanes] marked', { tabId: activeTab.id });
      return;
    }
    d.commitActiveTab((t) => ({
      ...t,
      elements: settleNotesOnLanes(t.elements).elements,
      esLanesSettled: true,
    }));
    d.toastInfo(settleToast(movedIds.length));
    track('Canvas', 'Used', 'LanesSettled');
    console.info('[es-lanes] settled', { tabId: activeTab.id, moved: movedIds.length });
  }, [activeTab, editsBlocked]);
}
