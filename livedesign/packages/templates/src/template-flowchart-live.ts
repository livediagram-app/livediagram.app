// The flowchart-family templates as live flowcharts (docs/specs/009-elements/flowchart.md "Templates"):
// a template's steps, connectors and lanes become one chart, laid out by the flowchart layout itself,
// so the template is tidy by construction and Tab / Enter grow it in place without the first growth
// re-arranging what the template drew. Pure: steps in, laid-out elements and their bounds out.

import {
  relayoutFlowchart,
  type ArrowElement,
  type Element,
  type FlowchartDirection,
  type ShapeElement,
} from '@livepages/document';

type LiveFlowchart = {
  elements: Element[];
  bounds: { x: number; y: number; width: number; height: number };
};

/**
 * The chart made of `steps` (the first is its first step and names it), joined by `connectors`, in
 * `lanes` when given (each step's `flowLaneId` names its lane), laid out flowing `direction` and then
 * moved so its bounds' top-left sits at (`left`, `top`). Lanes go first, under the steps.
 */
export function liveFlowchart(
  steps: readonly ShapeElement[],
  connectors: readonly ArrowElement[],
  opts: {
    direction: FlowchartDirection;
    lanes?: readonly ShapeElement[];
    left: number;
    top: number;
  },
): LiveFlowchart {
  const chartId = steps[0]!.id;
  const lanes = (opts.lanes ?? []).map((l) => ({ ...l, flowchartId: chartId }));
  const members = steps.map((s) => ({ ...s, flowchartId: chartId, flowDirection: opts.direction }));
  const laid = relayoutFlowchart([...lanes, ...connectors, ...members], chartId);
  const boxes = laid.filter(
    (el): el is ShapeElement => el.type === 'shape' && el.flowchartId === chartId,
  );
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const width = Math.max(...boxes.map((b) => b.x + b.width)) - x0;
  const height = Math.max(...boxes.map((b) => b.y + b.height)) - y0;
  const dx = Math.round(opts.left - x0);
  const dy = Math.round(opts.top - y0);
  return {
    elements: laid.map((el) =>
      el.type === 'shape' && el.flowchartId === chartId
        ? { ...el, x: el.x + dx, y: el.y + dy }
        : el,
    ),
    bounds: { x: opts.left, y: opts.top, width, height },
  };
}
