import {
  applyMindMoves,
  isMindNode,
  mindRootOf,
  relayoutMindMap,
  type Element,
  type MindFlow,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

type MindMapSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The active tab's elements now, to tell a tidy that moves nodes from one that moves none.
  elements: () => Element[];
  // An in-page notification (the editor's toast).
  notify: (tone: 'success' | 'info', message: string) => void;
};

// The Mind Map menu section's actions (docs/specs/009-elements/mind-node.md "Flows" + "Tidy Map"): the
// shape the selected node's whole map grows in, and laying that map out
// tidily. Both act on the map's ROOT, so selecting several nodes of one map
// acts on it once.
export function useMindMapSetters({
  currentSelectionIds,
  commit,
  elements,
  notify,
}: MindMapSetterDeps) {
  // The roots of every map with a selected node. Resolved inside the updater,
  // against the elements as they stand: the walk up to a root has to read the
  // same array it writes back.
  const selectedRoots = (all: Element[], ids: Set<string>) => [
    ...new Set(
      all
        .filter((el) => ids.has(el.id))
        .filter(isMindNode)
        .map((el) => mindRootOf(all, el).id),
    ),
  ];

  // Lay each map out (in `flow` when given), with the flow stored on its root,
  // as one commit, so the change and its re-layout are one undo step.
  const relayoutSelected = (flow?: MindFlow, ids = currentSelectionIds()) => {
    if (ids.size === 0) return;
    commit((all) => {
      let next = all;
      for (const rootId of selectedRoots(all, ids)) {
        const plan = relayoutMindMap(next, rootId, flow);
        if (!plan) continue;
        next = applyMindMoves(next, plan.moves, plan.reanchored);
        if (flow) next = next.map((el) => (el.id === rootId ? { ...el, mindFlow: flow } : el));
        debugLog(
          `[mind-layout] relayout root=${rootId} flow=${flow ?? 'current'} moves=${plan.moves.length}`,
        );
      }
      return next;
    });
  };

  // Picking a flow re-lays the map out in it straight away: a flow that only
  // changed where the NEXT node would land left the map looking the same after
  // the click, so the pick looked broken.
  const setMindFlowSelected = (flow: MindFlow) => {
    relayoutSelected(flow);
    track('Element', 'Changed', 'MindFlow');
  };

  // Tidy Map on the maps of `ids`, saying what it did: "Map tidied", or "Map already tidy" when
  // no node moves and no connector re-anchors.
  const tidy = (ids: Set<string>) => {
    if (ids.size === 0) return;
    const all = elements();
    const changes = selectedRoots(all, ids).some((rootId) => {
      const plan = relayoutMindMap(all, rootId);
      return !!plan && (plan.moves.length > 0 || plan.reanchored.length > 0);
    });
    if (changes) relayoutSelected(undefined, ids);
    debugLog(`[mind-layout] tidy changed=${changes}`);
    notify(changes ? 'success' : 'info', changes ? 'Map tidied' : 'Map already tidy');
    track('Element', 'Changed', 'MindTidy');
  };

  const tidyMindMapSelected = () => tidy(currentSelectionIds());

  // Tidy Map on the map `id` belongs to: the badge on a map's root (element-badges.tsx).
  const tidyMindMap = (id: string) => tidy(new Set([id]));

  return { setMindFlowSelected, tidyMindMapSelected, tidyMindMap };
}
