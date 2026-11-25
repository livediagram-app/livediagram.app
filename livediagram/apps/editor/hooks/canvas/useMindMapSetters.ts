import {
  applyMindMoves,
  isMindNode,
  lockedLayerElementIds,
  mindRootOf,
  relayoutMindMap,
  type Element,
  type Layer,
  type MindFlow,
  type MindSpacing,
} from '@livediagram/document';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

type MindMapSetterDeps = {
  currentSelectionIds: () => Set<string>;
  commit: (mapElements: (els: Element[]) => Element[]) => void;
  // The active tab's elements now, to tell a tidy that moves nodes from one that moves none.
  elements: () => Element[];
  // The active tab's layers: nodes on a locked layer keep their place, like a locked node.
  layers?: () => Layer[] | undefined;
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
  layers,
  notify,
}: MindMapSetterDeps) {
  const heldIn = (els: Element[]) => lockedLayerElementIds(els, layers?.());
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
        next = applyMindMoves(next, plan.moves, plan.reanchored, heldIn(next));
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

  // Spacing (docs/specs/009-elements/mind-node.md "Spacing"): stored on each selected map's root, then the map
  // re-laid out at it, as one commit, the same way a flow pick re-lays it out.
  const setMindSpacingSelected = (spacing: MindSpacing) => {
    const ids = currentSelectionIds();
    if (ids.size === 0) return;
    commit((all) => {
      let next = all;
      for (const rootId of selectedRoots(all, ids)) {
        next = next.map((el) => (el.id === rootId ? { ...el, mindSpacing: spacing } : el));
        const plan = relayoutMindMap(next, rootId);
        if (plan) next = applyMindMoves(next, plan.moves, plan.reanchored, heldIn(next));
        debugLog(`[mind-layout] spacing root=${rootId} spacing=${spacing}`);
      }
      return next;
    });
    track('Element', 'Changed', 'MindSpacing');
  };

  // Tidy Map on the maps of `ids`, saying what it did: "Map tidied", or "Map already tidy" when
  // no node moves and no connector re-anchors, a locked one that keeps its place included. Nodes a
  // locked layer holds are counted: "Map tidied, 2 nodes held by a locked layer".
  const tidy = (ids: Set<string>) => {
    if (ids.size === 0) return;
    const all = elements();
    const held = heldIn(all);
    const onLayer = new Set<string>();
    const changes = selectedRoots(all, ids).some((rootId) => {
      const plan = relayoutMindMap(all, rootId);
      if (!plan) return false;
      for (const m of plan.moves) if (held.has(m.id)) onLayer.add(m.id);
      const next = applyMindMoves(all, plan.moves, plan.reanchored, held);
      return next.some((el, i) => el !== all[i]);
    });
    // A node of its own lock on a locked layer is reported by its layer only once, and a node a
    // plan leaves alone is not counted.
    const heldCount = [...onLayer].filter(
      (id) => all.find((e) => e.id === id)?.locked !== true,
    ).length;
    if (changes) relayoutSelected(undefined, ids);
    debugLog(`[mind-layout] tidy changed=${changes} held=${heldCount}`);
    const said = changes ? 'Map tidied' : 'Map already tidy';
    notify(
      changes ? 'success' : 'info',
      heldCount > 0
        ? `${said}, ${heldCount} ${heldCount === 1 ? 'node' : 'nodes'} held by a locked layer`
        : said,
    );
    track('Element', 'Changed', 'MindTidy');
  };

  const tidyMindMapSelected = () => tidy(currentSelectionIds());

  // Tidy Map on the map `id` belongs to: the badge on a map's root (element-badges.tsx).
  const tidyMindMap = (id: string) => tidy(new Set([id]));

  return { setMindFlowSelected, setMindSpacingSelected, tidyMindMapSelected, tidyMindMap };
}
