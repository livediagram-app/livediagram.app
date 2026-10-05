// Pure tab builders (docs/specs/015-api/mcp-server.md, docs/specs/024-agents/edit-operations.md):
// validated elements or a node/edge graph turned into a finished, themed, persistable Tab, and the
// event-storming landing every authoring path shares. Render-free, so the MCP, the api and the CLI
// all build tabs the same way. Template tabs are `buildTemplateTab` in @livediagram/templates.

import { autoLayoutElements, isLayoutCandidate, nodesLookUnplaced } from './auto-layout';
import { isEventStormingNote, isEventStormingTab } from './event-storming';
import { landArrivals } from './event-storming-lane-landing';
import { layoutGraph, type GraphInput } from './graph-input';
import { recolourElementsForTheme } from './theme-graph';
import { getBuiltInTheme } from './themes';
import { coerceShapeKind } from './validate';
import type { Element, Tab } from './index';

// Layout is the model's call (docs/specs/015-api/mcp-server.md §4.3). 'preserve' keeps the coordinates
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
// the same engine the editor uses (docs/specs/015-api/mcp-server.md). `themeId` defaults to brand;
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

// Build a tab from a node/edge graph (docs/specs/015-api/mcp-server.md §4.7): capped, laid out in its
// chosen style and direction, arrows routed (graph-input.ts), then themed. The
// layout is already done, so buildTab keeps it.
export function buildGraphTab(
  tabId: string,
  name: string,
  graph: GraphInput,
  themeId: string | undefined,
): Tab {
  return buildTab(tabId, name, layoutGraph(graph), 'preserve', themeId);
}

// Workshop notes a call adds or moves on an event-storming tab land on lanes
// (docs/specs/021-event-storming/event-storming.md "Always on a lane"), exactly as a paste does: a lane per row,
// and a lone arrival on an occupied spot takes the nearest free slot. In ops
// mode the arrivals are the workshop notes that are new or whose x / y an op
// changed; in replace mode every workshop note arrives. Nothing else moves,
// and an ordinary tab comes back exactly as the call wrote it.
export function landWorkshopArrivals(
  before: Pick<Tab, 'elements'> & Partial<Pick<Tab, 'kind' | 'layers'>>,
  next: Element[],
  mode: 'ops' | 'replace',
): Element[] {
  if (!isEventStormingTab(before)) return next;
  const previous = new Map(before.elements.map((el) => [el.id, el] as const));
  const arrivals = new Set<string>();
  for (const el of next) {
    if (!isEventStormingNote(el) || !('x' in el)) continue;
    const was = previous.get(el.id);
    const moved = !was || !('x' in was) || was.x !== el.x || was.y !== el.y;
    if (mode === 'replace' || moved) arrivals.add(el.id);
  }
  if (arrivals.size === 0) return next;
  return landArrivals(next, arrivals, { x: arrivals.size === 1 ? 'free-slot' : 'keep' });
}
