import {
  applyMindMoves,
  isMindNode,
  isMindTreeTidy,
  mindChildren,
  mindFlowOf,
  mindRootOf,
  planMindGrowth,
  relayoutMindMap,
  type ArrowElement,
  type Element,
  type MindGrowthPlan,
  type ShapeElement,
} from '@liveplanner/document';
import { dressMindConnector, dressMindNode } from '@/lib/mind-dress';
import { fitMindLabel } from '@/lib/mind-label-fit';
import { measureDrawnMindLabel } from '@/components/canvas/text-hug-measure';
import { useLatest } from '@/hooks/ui/useLatest';
import type { HandoffActions } from '@/lib/mind-handoff';
import {
  labelled,
  patchActiveElements,
  touchesPinned,
  useGrowthLanding,
  type GrowthHookOpts,
} from './useGrowthLanding';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

// Mind-map growth in the editor (docs/specs/009-elements/mind-node.md). Tab grows a child, Enter a
// sibling, from the keyboard (the label editor or a selected node) or the "+"
// ring; the new node is placed by the package's planner, dressed like its
// level, wired to its parent, selected and scrolled into view, all as ONE undo
// step. It is not put into label editing: typing on it opens the editor.
export function useMindGrowth(opts: GrowthHookOpts) {
  const { editsBlocked, activeTab, setSelectedId, setEditingId } = opts;
  const patchActive = (map: (els: Element[]) => Element[]) => patchActiveElements(opts, map);
  const { reveal, escapeGrown } = useGrowthLanding(opts);

  const canGrowMindNode = (id: string) => {
    if (editsBlocked) return false;
    const el = activeTab.elements.find((e) => e.id === id);
    return !!el && isMindNode(el);
  };

  // The new node's look: the tab's theme, then its level's (lib/mind-dress.ts).
  // In a person map (docs/specs/009-elements/org-chart.md) the node and its connector take the org chart's look.
  const rootOf = (id: string): ShapeElement | null => {
    const from = activeTab.elements.find((e) => e.id === id);
    return from && isMindNode(from) ? mindRootOf(activeTab.elements, from) : null;
  };
  const dress = (
    node: ShapeElement,
    styleFrom: ShapeElement | null,
    root: ShapeElement | null,
  ): ShapeElement => dressMindNode(node, styleFrom, activeTab, root);

  // A label written here never passed through an editor, so the node grows to fit it here
  // (docs/specs/009-elements/mind-node.md "A node grows to fit its label").
  const measureLabel = measureDrawnMindLabel(activeTab.font, activeTab.finish);
  const withLabelOn = (els: Element[], id: string, label: string) =>
    fitMindLabel(
      els.map((el) => (el.id === id ? labelled(el, label) : el)),
      id,
      measureLabel,
    );

  // What was typed for a node whose editor never opened (the handoff timed
  // out): written straight onto its label, so nothing typed is lost.
  const settleLabel = (id: string, text: string) =>
    patchActive((els) => withLabelOn(els, id, text));

  // `label`, when given, is written onto the node grown FROM in the same
  // commit: the typing-ahead handoff finishing a node whose editor never
  // opened (lib/mind-handoff.ts).
  const growMindNode = (id: string, kind: 'child' | 'sibling', label?: string) => {
    if (editsBlocked) return;
    const withLabel = (els: Element[]) => (label === undefined ? els : withLabelOn(els, id, label));
    const ids = { node: crypto.randomUUID(), arrow: crypto.randomUUID() };
    // Planned once from the tab as rendered, to bail early and to know where the node lands, and
    // again inside the commit: the label typed before this Tab committed a moment ago (and may
    // have grown its node and re-laid the map), so only the tab as it stands in the commit
    // places the new node clear of it. The ids are fixed, so both plans name the same node.
    const before = activeTab.elements;
    const plan = planMindGrowth(before, id, kind, ids);
    if (!plan) return;
    const root = rootOf(id);
    const build = (p: MindGrowthPlan) => {
      const node = dress(p.node, p.styleFrom, root);
      const arrow: ArrowElement | null = p.arrow
        ? dressMindConnector(p.arrow, p.connectorStyleFrom)
        : null;
      return { node, added: arrow ? [node, arrow] : [node] };
    };
    const { node } = build(plan);
    const grown = (els: Element[]) => {
      const base = withLabel(els);
      // Re-planned only when the tab moved on since this render: planning is O(nodes x map) and
      // the canvas keys (no label commit in between) need it once.
      const now = base === before ? plan : (planMindGrowth(base, id, kind, ids) ?? plan);
      return [...applyMindMoves(base, now.moves, now.reanchored), ...build(now).added];
    };
    patchActive(grown);
    reveal(node, handoffActions);
    debugLog(
      `[mind-grow] ${kind} from=${id} node=${node.id} moves=${plan.moves.length} style=${plan.styleFrom ? 'level' : 'default'}`,
    );
    track('Element', 'Added', 'MindNode');
  };

  // Escape on the empty node a Tab made one time too many
  // (docs/specs/009-elements/mind-node.md "Escape keeps what you typed"): only a childless node with a
  // parent, so a root or a node with a branch under it is never lost this way.
  const abandonMindNode = (id: string): boolean => {
    if (editsBlocked) return false;
    const before = activeTab.elements;
    const el = before.find((e) => e.id === id);
    if (!el || !isMindNode(el) || !el.mindParentId) return false;
    if (mindChildren(before, id).length > 0) return false;
    const keep = (e: Element) => e.id !== id && !touchesPinned(e, id);
    // The growth that made this node may have slid its siblings apart to make
    // room. A map that was tidy closes the gap again, so it stays tidy and
    // keeps growing tidily; a hand-arranged one is left exactly as it was.
    const root = mindRootOf(before, el);
    const wasTidy = isMindTreeTidy(before, root.id, mindFlowOf(before, el));
    const remove = (els: Element[]) => {
      const next = els.filter(keep);
      const plan = wasTidy ? relayoutMindMap(next, root.id) : null;
      return plan ? applyMindMoves(next, plan.moves, plan.reanchored) : next;
    };
    patchActive(remove);
    setEditingId(null);
    setSelectedId(el.mindParentId);
    track('Element', 'Deleted', 'MindNode');
    return true;
  };

  // The handoff calls back a task later, after further renders: always into
  // the LATEST state, never the closure that opened it.
  const latest = useLatest({ settleLabel, growMindNode, abandonMindNode });

  const escapeGrownMindNode = (id: string): boolean => escapeGrown(id, abandonMindNode);

  const handoffActions: HandoffActions = {
    settle: (id, text) => latest.current.settleLabel(id, text),
    grow: (id, kind, label) => latest.current.growMindNode(id, kind, label),
    abandon: (id) => void latest.current.abandonMindNode(id),
  };

  return {
    canGrowMindNode,
    growMindNode: (id: string, kind: 'child' | 'sibling') => growMindNode(id, kind),
    abandonMindNode,
    escapeGrownMindNode,
  };
}
