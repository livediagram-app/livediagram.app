// Pure tab builders (docs/specs/015-api/mcp-server.md, docs/specs/024-agents/edit-operations.md):
// validated elements turned into a finished, themed, persistable Tab. Render-free, so the MCP, the api and the CLI
// all build tabs the same way. Template tabs are `buildTemplateTab` in @livepages/templates.

import { withFacingBends } from './arrow-orthogonal';
import { autoLayoutElements, isLayoutCandidate, nodesLookUnplaced } from './auto-layout';
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
  // An angled arrow left as an L between ends that face each other bends twice instead (layout-cleanup.md).
  const laidOut = withFacingBends(applyLayout(layout, coerced));
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
