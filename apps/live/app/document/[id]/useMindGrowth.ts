import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
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
  type Tab,
} from '@livediagram/document';
import { dressMindConnector, dressMindNode } from '@/lib/mind-dress';
import { fitMindLabel } from '@/lib/mind-label-fit';
import { measureDrawnMindLabel } from '@/components/canvas/text-hug-measure';
import { useLatest } from '@/hooks/ui/useLatest';
import { beginMindHandoff, landMindHandoff, type HandoffActions } from '@/lib/mind-handoff';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

type SetState<T> = Dispatch<SetStateAction<T>>;

// A plain-text label, replacing any formatted runs the node carried.
const labelled = (el: Element, label: string): Element =>
  ({ ...el, label, richText: undefined }) as Element;

// Clear of the palette and the Quick Style panel docked along the canvas's
// sides, so a node grown past the edge scrolls into the open, not under a
// panel (docs/specs/009-elements/mind-node.md "Following the growth").
const MIND_REVEAL_SIDE_MARGIN = 300;

// Mind-map growth in the editor (docs/specs/009-elements/mind-node.md). Tab grows a child, Enter a
// sibling, from the keyboard (the label editor or a selected node) or the "+"
// ring; the new node is placed by the package's planner, dressed like its
// level, wired to its parent, selected and scrolled into view, all as ONE undo
// step. It is not put into label editing: typing on it opens the editor.
export function useMindGrowth(opts: {
  editsBlocked: boolean;
  // A Participant's growth leaves the tab's own fields alone: it never edits a tab's settings.
  participating?: boolean;
  activeId: string;
  activeTab: Tab;
  commitTabs: (updater: (tabs: Tab[]) => Tab[]) => void;
  setSelectedId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  scrollIntoView: (
    x: number,
    y: number,
    w: number,
    h: number,
    opts?: { sideMargin?: number },
  ) => void;
}) {
  const {
    editsBlocked,
    participating = false,
    activeId,
    activeTab,
    commitTabs,
    setSelectedId,
    setEditingId,
    scrollIntoView,
  } = opts;

  const patchActive = (map: (els: Element[]) => Element[]) =>
    commitTabs((ts) =>
      ts.map((t) =>
        t.id !== activeId
          ? t
          : participating
            ? { ...t, elements: map(t.elements) }
            : { ...t, elements: map(t.elements), templateChosen: true },
      ),
    );

  const canGrowMindNode = (id: string) => {
    if (editsBlocked) return false;
    const el = activeTab.elements.find((e) => e.id === id);
    return !!el && isMindNode(el);
  };

  // The grown node waiting to reach the screen, and the last one grown (for
  // Escape on it while still empty).
  const landing = useRef<string | null>(null);
  const lastGrown = useRef<string | null>(null);

  // The new node's look: the tab's theme, then its level's (lib/mind-dress.ts).
  const dress = (node: ShapeElement, styleFrom: ShapeElement | null): ShapeElement =>
    dressMindNode(node, styleFrom, activeTab);

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
    const build = (p: MindGrowthPlan) => {
      const node = dress(p.node, p.styleFrom);
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
    // Grown from inside a label editor, that editor closes with the commit.
    setEditingId(null);
    setSelectedId(node.id);
    // Keys typed before the new node is on screen are held for it.
    beginMindHandoff(node.id, handoffActions);
    landing.current = node.id;
    lastGrown.current = node.id;
    scrollIntoView(node.x, node.y, node.width, node.height, {
      sideMargin: MIND_REVEAL_SIDE_MARGIN,
    });
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
    const touches = (e: Element) =>
      e.type === 'arrow' &&
      ((e.from.kind === 'pinned' && e.from.elementId === id) ||
        (e.to.kind === 'pinned' && e.to.elementId === id));
    const keep = (e: Element) => e.id !== id && !touches(e);
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

  // Escape on the node a growth just made, still selected and never labelled:
  // the Tab one time too many, removed as from its label editor. Any other
  // node keeps its usual Escape (deselect).
  const escapeGrownMindNode = (id: string): boolean => {
    if (lastGrown.current !== id) return false;
    lastGrown.current = null;
    const el = activeTab.elements.find((e) => e.id === id);
    if (!el || (el.label ?? '').trim() !== '') return false;
    return abandonMindNode(id);
  };

  // Once the grown node is on screen the keyboard handoff ends: keys typed in
  // the gap open its editor to take them; otherwise it just stays selected.
  useEffect(() => {
    const id = landing.current;
    if (!id || !activeTab.elements.some((e) => e.id === id)) return;
    landing.current = null;
    if (landMindHandoff(id)) setEditingId(id);
  }, [activeTab.elements, setEditingId]);
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
