import { type Dispatch, type SetStateAction } from 'react';
import {
  applyMindMoves,
  isMindNode,
  isMindTreeTidy,
  mindChildren,
  mindFlowOf,
  mindRootOf,
  MIND_CONNECTOR_LOOK,
  planMindGrowth,
  relayoutMindMap,
  type ArrowElement,
  type Element,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { paintableArrowFields, paintableBoxedFields } from '@/lib/format-painter';
import { useLatest } from '@/hooks/ui/useLatest';
import { beginMindHandoff, type HandoffActions } from '@/lib/mind-handoff';
import { track } from '@/lib/telemetry';
import { deriveNewBoxedColours } from '@/lib/themes';
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
// level, wired to its parent, selected, put into label editing, and scrolled
// into view, all as ONE undo step.
export function useMindGrowth(opts: {
  editsBlocked: boolean;
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
        t.id === activeId ? { ...t, elements: map(t.elements), templateChosen: true } : t,
      ),
    );

  const canGrowMindNode = (id: string) => {
    if (editsBlocked) return false;
    const el = activeTab.elements.find((e) => e.id === id);
    return !!el && isMindNode(el);
  };

  // The new node's look: the tab's theme like any new element, then its
  // level's look on top (docs/specs/009-elements/mind-node.md "A new node looks like its level").
  const dress = (node: ShapeElement, styleFrom: ShapeElement | null): ShapeElement => {
    const themed: ShapeElement = {
      ...node,
      ...deriveNewBoxedColours(node, {
        backgroundColor: activeTab.backgroundColor,
        patternColor: activeTab.patternColor,
        theme: activeTab.theme,
      }),
      ...(activeTab.defaultTextSize ? { textSize: activeTab.defaultTextSize } : {}),
    };
    if (!styleFrom) return themed;
    return { ...themed, ...(paintableBoxedFields(styleFrom) as Partial<ShapeElement>) };
  };

  // What was typed for a node whose editor never opened (the handoff timed
  // out): written straight onto its label, so nothing typed is lost.
  const settleLabel = (id: string, text: string) =>
    patchActive((els) => els.map((el) => (el.id === id ? labelled(el, text) : el)));

  // `label`, when given, is written onto the node grown FROM in the same
  // commit: the typing-ahead handoff finishing a node whose editor never
  // opened (lib/mind-handoff.ts).
  const growMindNode = (id: string, kind: 'child' | 'sibling', label?: string) => {
    if (editsBlocked) return;
    const withLabel = (els: Element[]) =>
      label === undefined ? els : els.map((el) => (el.id === id ? labelled(el, label) : el));
    const before = activeTab.elements;
    const plan = planMindGrowth(before, id, kind, {
      node: crypto.randomUUID(),
      arrow: crypto.randomUUID(),
    });
    if (!plan) return;
    const node = dress(plan.node, plan.styleFrom);
    const arrow: ArrowElement | null = plan.arrow
      ? {
          ...plan.arrow,
          ...(plan.connectorStyleFrom
            ? paintableArrowFields(plan.connectorStyleFrom)
            : MIND_CONNECTOR_LOOK),
        }
      : null;
    const added: Element[] = arrow ? [node, arrow] : [node];
    // Applied against the elements as they stand IN the commit, as patches:
    // the label typed before this Tab committed a moment ago and is not in
    // `before` yet.
    const grown = (els: Element[]) => [
      ...applyMindMoves(withLabel(els), plan.moves, plan.reanchored),
      ...added,
    ];
    patchActive(grown);
    setSelectedId(node.id);
    setEditingId(node.id);
    // Keys typed before the new editor has focus are held for it.
    beginMindHandoff(node.id, handoffActions);
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
  const handoffActions: HandoffActions = {
    settle: (id, text) => latest.current.settleLabel(id, text),
    grow: (id, kind, label) => latest.current.growMindNode(id, kind, label),
    abandon: (id) => void latest.current.abandonMindNode(id),
  };

  return {
    canGrowMindNode,
    growMindNode: (id: string, kind: 'child' | 'sibling') => growMindNode(id, kind),
    abandonMindNode,
  };
}
