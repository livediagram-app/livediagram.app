// Pure tab builders for the MCP tools (spec/62): turn validated elements, a
// node/edge graph, or a template kind into a finished, themed, persistable
// Tab. Split out of tool-helpers.ts because those also carry the inline-PNG
// result helper (imageResult → the resvg WASM renderer), which can't load in
// the plain-node test environment — keeping the builders render-free lets
// them be unit-tested directly.

import {
  autoLayoutElements,
  coerceShapeKind,
  getBuiltInTheme,
  graphToElements,
  isLayoutCandidate,
  nodesLookUnplaced,
  recolourElementsForTheme,
  type DiagramGraph,
  type Element,
  type Tab,
} from '@livediagram/diagram';
import {
  TEMPLATES,
  buildTemplate,
  templateCanvasOverrides,
  type TemplateKind,
} from '@livediagram/templates';

// Layout is the model's call (spec/62 §4.3). 'preserve' keeps the coordinates
// it gave (a ring for a cycle, a tree, a grid); 'auto' forces a clean server
// layout; omitted = preserve a real arrangement, but auto-lay-out when the
// model left everything piled at one spot. Either way the connected graph is
// the only thing arranged — edgeless content keeps its place.
export function applyLayout(
  layout: 'auto' | 'preserve' | undefined,
  elements: Element[],
): Element[] {
  const shouldLayout =
    layout === 'auto' ? true : layout === 'preserve' ? false : nodesLookUnplaced(elements);
  return shouldLayout && isLayoutCandidate(elements) ? autoLayoutElements(elements) : elements;
}

// Build a finished, persistable Tab from validated elements: apply the layout,
// then paint the chosen preset theme onto the elements + the canvas backdrop —
// the same engine the editor uses (spec/62). `themeId` defaults to brand;
// unknown ids fall back to it. `elements` must already be a valid Element[].
export function buildTab(
  tabId: string,
  name: string,
  elements: Element[],
  layout: 'auto' | 'preserve' | undefined,
  themeId: string | undefined,
): Tab {
  const theme = getBuiltInTheme(themeId);
  // Coerce off-vocabulary shape kinds (e.g. a model emitting "rectangle", which
  // isn't a kind — the box is "square") so every node actually renders a box.
  const coerced = elements.map((el) =>
    el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
  );
  const laidOut = applyLayout(layout, coerced);
  return {
    id: tabId,
    name,
    elements: recolourElementsForTheme(laidOut, theme),
    theme: theme.id,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
  };
}

// Build a tab from a node/edge graph (spec/62 §4.7): translate the graph to
// elements, then buildTab always auto-lays-it-out — a graph carries no
// positions, so the server owns placement.
export function buildGraphTab(
  tabId: string,
  name: string,
  graph: DiagramGraph,
  themeId: string | undefined,
): Tab {
  return buildTab(tabId, name, graphToElements(graph), 'auto', themeId);
}

// Resolve a tool's `template` argument against the shared catalogue
// (spec/62 §4.5). Returns null for an unknown kind — the caller answers
// with the valid kinds so the model can self-correct without a round
// trip to list_templates.
export function resolveTemplate(kind: string): TemplateKind | null {
  return TEMPLATES.some((t) => t.kind === kind) ? (kind as TemplateKind) : null;
}

export const validTemplateKinds = () => TEMPLATES.map((t) => t.kind).join(', ');

// Materialise a template tab: the curated scaffold at its hand-tuned
// coordinates (layout deliberately NOT run — that's the point of a
// template), themed by buildTab like any other elements, plus the
// template's canvas overrides + the templateChosen flag the editor's
// Quick Start uses.
export function buildTemplateTab(
  tabId: string,
  name: string,
  kind: TemplateKind,
  themeId?: string,
): Tab {
  return {
    ...buildTab(tabId, name, buildTemplate(kind, 0, 0), 'preserve', themeId),
    templateChosen: true,
    ...templateCanvasOverrides(kind),
  };
}
