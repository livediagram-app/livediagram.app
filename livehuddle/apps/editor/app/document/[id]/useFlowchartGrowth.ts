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
  type Tab,
} from '@livediagram/document';
import { dressFlowchartConnector, dressFlowchartStep } from '@/lib/flowchart-dress';
import { lockedElementIds } from '@/lib/tab-cleanup';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import type { HandoffActions } from '@/lib/mind-handoff';
import {
  labelled,
  patchActiveElements,
  touchesPinned,
  useGrowthLanding,
  type GrowthHookOpts,
} from './useGrowthLanding';
import { track } from '@/lib/telemetry';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

// Flowchart growth in the editor (docs/specs/009-elements/flowchart.md). Tab adds the next step,
// Enter a parallel one, from the keyboard (the label editor or a selected step), the toolbar or the
// "+" ring; the step is planned by the package with the whole chart laid out around it, dressed,
// selected and scrolled into view, all as ONE undo step. Keys typed before it reaches the screen are
// held for it by the same handoff a mind node uses (lib/mind-handoff.ts).
export function useFlowchartGrowth(opts: GrowthHookOpts) {
  const { editsBlocked, activeTab, setSelectedId, setEditingId } = opts;
  const patchActive = (map: (els: Element[], tab: Tab) => Element[]) =>
    patchActiveElements(opts, map);
  const { reveal, escapeGrown } = useGrowthLanding(opts);

  const canGrowFlowchartStep = (id: string) => {
    if (editsBlocked) return false;
    const el = activeTab.elements.find((e) => e.id === id);
    return !!el && isFlowchartStep(el);
  };

  const settleLabel = (id: string, text: string) =>
    patchActive((els) => els.map((el) => (el.id === id ? labelled(el, text) : el)));

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
    patchActive((els) =>
      applyFlowchartStep(
        label === undefined ? els : els.map((el) => (el.id === id ? labelled(el, label) : el)),
        plan,
        step,
        connector,
      ),
    );
    reveal(step, handoffActions);
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
    patchActive((els, t) => {
      const next = els.filter((e) => e.id !== id && !touchesPinned(e, id));
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

  const escapeGrownFlowchartStep = (id: string): boolean => escapeGrown(id, abandonFlowchartStep);

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
