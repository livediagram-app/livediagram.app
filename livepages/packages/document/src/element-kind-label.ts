import { FLOWCHART_STEP_LABEL, flowchartStepTypeOf, isFlowchartStep } from './flowchart';
import type { Element, ShapeKind } from './index';
import { CHART_TYPE_LABELS, chartTypeOf } from './chart-types';

// Human-readable name for a shape kind, e.g. 'square' -> 'Square',
// 'speech-bubble' -> 'Speech Bubble'. Used in selection labels and any
// surface that wants to name the kind of element a user has selected.
const SHAPE_LABELS: Partial<Record<ShapeKind, string>> = {
  'speech-bubble': 'Speech Bubble',
  'plan-sheet': 'Sheet',
  icon: 'Icon',
  'progress-bar': 'Progress Bar',
  'progress-ring': 'Progress Ring',
  // Named for what it does, not its internal kind — titleCase would say
  // 'Mode Button' (docs/specs/009-elements/mode-button.md).
  'mode-button': 'Selection Mode',
  // Both would title-case to a bare noun that says the wrong thing on its own
  // ('Decision', 'Temperature'), so they carry the full name (docs/specs/012-collaboration/temperature-check.md,
  // docs/specs/012-collaboration/decision-record.md).
  decision: 'Decision Record',
  temperature: 'Temperature Check',
  // 'Sankey' alone names a person, not a picture (docs/specs/009-elements/sankey.md).
  sankey: 'Sankey Diagram',
};

function titleCase(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// A short, human-readable name for what an element IS, e.g. 'Square',
// 'Table', 'Icon', 'Text', 'Sticky', 'Arrow'. Title-cased so callers that
// uppercase (e.g. a selection caption) read naturally.
export function elementKindLabel(el: Element): string {
  switch (el.type) {
    case 'shape': {
      // A flowchart step IS its step type (docs/specs/009-elements/flowchart.md): "Selected Decision",
      // never "Selected Diamond".
      const step = isFlowchartStep(el) ? flowchartStepTypeOf(el.shape) : undefined;
      if (step) return FLOWCHART_STEP_LABEL[step];
      // A chart IS its chart type (docs/specs/009-elements/pie-chart.md "Chart types"): the palette's "Column Chart"
      // was "Selected Bar Chart", from its stored kind, and an area chart read as a line chart.
      const chart = chartTypeOf(el);
      if (chart) return `${CHART_TYPE_LABELS[chart]} Chart`;
      return SHAPE_LABELS[el.shape] ?? titleCase(el.shape);
    }
    case 'text':
      return 'Text';
    case 'table':
      return 'Table';
    case 'sticky':
      return 'Sticky';
    case 'image':
      return 'Image';
    case 'freehand':
      // The marker pen (docs/specs/008-canvas/highlighter.md) and polygon tool (docs/specs/008-canvas/polygon-tool.md) both commit
      // freehands; name them by what the user drew (matching the live
      // app's kindLabel in element-names.ts).
      if (el.pen === 'highlighter') return 'Highlight';
      if (el.straightEdges) return el.closed ? 'Polygon' : 'Polyline';
      return 'Sketch';
    case 'annotation':
      return 'Annotation';
    case 'link-card':
      return 'Link';
    case 'video':
      // The kind stays 'video' (it is persisted); the NAME is Embed, since it
      // carries Figma files and Google Docs as well now (docs/specs/009-elements/embed-providers.md).
      return 'Embed';
    case 'arrow':
      return 'Arrow';
  }
}
