import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import {
  applyFlowchartLayout,
  applyFlowchartStep,
  flowchartConnectors,
  isFlowchartStep,
  layoutFlowchart,
  planFlowchartStep,
  type Element,
  type FlowchartGrowth,
  type FlowchartStepType,
  type ShapeElement,
  type Tab,
} from '@livediagram/document';
import { dressFlowchartConnector, dressFlowchartStep } from '@/lib/flowchart-dress';
import { lockedElementIds } from '@/lib/tab-cleanup';
import { useLatest } from '@/hooks/ui/useLatest';
import { beginMindHandoff, landMindHandoff, type HandoffActions } from '@/lib/mind-handoff';
import { track } from '@/lib/telemetry';
import { debugLog } from '@/lib/debug-log';

type SetState<T> = Dispatch<SetStateAction<T>>;

// A plain-text label, replacing any formatted runs the step carried.
const labelled = (el: Element, label: string): Element =>
  ({ ...el, label, richText: undefined }) as Element;

// Clear of the palette and the Quick Style panel, as a grown mind node is.
const FLOWCHART_REVEAL_SIDE_MARGIN = 300;

// Flowchart growth in the editor (docs/specs/009-elements/flowchart.md). Tab adds the next step,
// Enter a parallel one, from the keyboard (the label editor or a selected step), the toolbar or the
// "+" ring; the step is planned by the package with the whole chart laid out around it, dressed,
// selected and scrolled into view, all as ONE undo step. Keys typed before it reaches the screen are
// held for it by the same handoff a mind node uses (lib/mind-handoff.ts).
export function useFlowchartGrowth(opts: {
  editsBlocked: boolean;
  // A Participant's growth leaves the tab's own fields alone, as a mind map's does.
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

  const patchActive = (map: (t: Tab) => Element[]) =>
    commitTabs((ts) =>
      ts.map((t) =>
        t.id !== activeId
          ? t
          : participating
            ? { ...t, elements: map(t) }
            : { ...t, elements: map(t), templateChosen: true },
      ),
    );

  const canGrowFlowchartStep = (id: string) => {
    if (editsBlocked) return false;
    const el = activeTab.elements.find((e) => e.id === id);
    return !!el && isFlowchartStep(el);
  };

  // The grown step waiting to reach the screen, and the last one grown (for Escape on it).
  const landing = useRef<string | null>(null);
  const lastGrown = useRef<string | null>(null);

  const settleLabel = (id: string, text: string) =>
    patchActive((t) => t.elements.map((el) => (el.id === id ? labelled(el, text) : el)));

  // `label`, when given, is written onto the step grown FROM in the same commit: the typing-ahead
  // handoff finishing a step whose editor never opened.
  const growFlowchartStep = (
    id: string,
    kind: FlowchartGrowth,
    label?: string,
    type?: FlowchartStepType,
  ) => {
    if (editsBlocked) return;
    const before = activeTab.elements;
    const plan = planFlowchartStep(
      before,
      id,
      kind,
      { step: crypto.randomUUID(), connector: crypto.randomUUID() },
      type,
      { lockedIds: lockedElementIds(before, activeTab.layers) },
    );
    if (!plan) return;
    const step = dressFlowchartStep(plan.step, plan.styleFrom, activeTab);
    const connector = dressFlowchartConnector(plan.connector, plan.connectorStyleFrom);
    // Applied against the elements as they stand IN the commit, as patches: the label typed before
    // this Tab committed a moment ago and is not in `before` yet.
    patchActive((t) => {
      const els =
        label === undefined
          ? t.elements
          : t.elements.map((el) => (el.id === id ? labelled(el, label) : el));
      return applyFlowchartStep(els, plan, step, connector);
    });
    setEditingId(null);
    setSelectedId(step.id);
    beginMindHandoff(step.id, handoffActions);
    landing.current = step.id;
    lastGrown.current = step.id;
    scrollIntoView(step.x, step.y, step.width, step.height, {
      sideMargin: FLOWCHART_REVEAL_SIDE_MARGIN,
    });
    debugLog(
      `[flowchart-grow] ${kind} from=${id} step=${step.id} moves=${plan.layout.steps.size} label=${connector.label ?? '-'}`,
    );
    track('Element', 'Added', 'FlowchartStep');
  };

  // Escape on the empty step a Tab made one time too many: only a step something leads to and
  // nothing leaves, so a chart's start or a step with a branch after it is never lost this way.
  const abandonFlowchartStep = (id: string): boolean => {
    if (editsBlocked) return false;
    const before = activeTab.elements;
    const el = before.find((e) => e.id === id);
    if (!el || !isFlowchartStep(el)) return false;
    const connectors = flowchartConnectors(before, el.flowchartId!);
    const into = connectors.find((a) => a.to.kind === 'pinned' && a.to.elementId === id);
    const out = connectors.some((a) => a.from.kind === 'pinned' && a.from.elementId === id);
    if (!into || out || into.from.kind !== 'pinned') return false;
    const source = into.from.elementId;
    const touches = (e: Element) =>
      e.type === 'arrow' &&
      ((e.from.kind === 'pinned' && e.from.elementId === id) ||
        (e.to.kind === 'pinned' && e.to.elementId === id));
    patchActive((t) => {
      const next = t.elements.filter((e) => e.id !== id && !touches(e));
      const layout = layoutFlowchart(next, el.flowchartId!, {
        lockedIds: lockedElementIds(next, t.layers),
      });
      return applyFlowchartLayout(next, layout);
    });
    setEditingId(null);
    setSelectedId(source);
    track('Element', 'Deleted', 'FlowchartStep');
    return true;
  };

  // The handoff calls back a task later, after further renders: always into the LATEST state.
  const latest = useLatest({ settleLabel, growFlowchartStep, abandonFlowchartStep });

  const escapeGrownFlowchartStep = (id: string): boolean => {
    if (lastGrown.current !== id) return false;
    lastGrown.current = null;
    const el = activeTab.elements.find((e) => e.id === id) as ShapeElement | undefined;
    if (!el || (el.label ?? '').trim() !== '') return false;
    return abandonFlowchartStep(id);
  };

  useEffect(() => {
    const id = landing.current;
    if (!id || !activeTab.elements.some((e) => e.id === id)) return;
    landing.current = null;
    if (landMindHandoff(id)) setEditingId(id);
  }, [activeTab.elements, setEditingId]);
  // The handoff speaks the mind map's words: a child is the next step, a sibling a parallel one.
  const handoffActions: HandoffActions = {
    settle: (id, text) => latest.current.settleLabel(id, text),
    grow: (id, kind, label) =>
      latest.current.growFlowchartStep(id, kind === 'child' ? 'next' : 'parallel', label),
    abandon: (id) => void latest.current.abandonFlowchartStep(id),
  };

  return {
    canGrowFlowchartStep,
    growFlowchartStep: (id: string, kind: FlowchartGrowth, type?: FlowchartStepType) =>
      growFlowchartStep(id, kind, undefined, type),
    abandonFlowchartStep,
    escapeGrownFlowchartStep,
  };
}
