// How a new flowchart step and its connector look (docs/specs/009-elements/flowchart.md "A new step
// looks like its type", "Connectors"): the tab's theme like any new element, then the look of the
// chart's latest step of the same type, never its size (a step is its type's size, which the layout
// keeps). The connector takes the chart's latest connector's look, else an angled arrow.
import type { ArrowElement, ShapeElement, Tab } from '@livedesign/document';
import { paintableArrowFields } from '@/lib/format-painter';
import { dressMindNode } from '@/lib/mind-dress';

/** A new step in the tab's theme, then in `styleFrom`'s look at its own size. */
export function dressFlowchartStep(
  step: ShapeElement,
  styleFrom: ShapeElement | null,
  tab: Pick<Tab, 'backgroundColor' | 'patternColor' | 'theme' | 'defaultTextSize'>,
): ShapeElement {
  const dressed = dressMindNode(step, styleFrom, tab);
  return { ...dressed, width: step.width, height: step.height };
}

/** A new connector in `from`'s look (its own label kept), else the angled default it was made with. */
export function dressFlowchartConnector(
  connector: ArrowElement,
  from: ArrowElement | null,
): ArrowElement {
  if (!from) return connector;
  const look = paintableArrowFields(from);
  return { ...connector, ...look, label: connector.label };
}
