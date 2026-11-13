// Pure tab builders (each product's MCP server and edit-operations specs): validated elements turned into a
// finished, themed, persistable tab. Render-free, so the MCP, the api and the CLI all build tabs the same way.
// livedesign, livedocuments and liveplanner share them; each hands in its shape-kind coercion and, for a
// product with diagram keys, the settling its editor does on commit. Template tabs are each product's
// `buildTemplateTab`.

import { withFacingBends } from './arrow-orthogonal';
import { autoLayoutElements, isLayoutCandidate, nodesLookUnplaced } from './auto-layout';
import type { Element } from './element';
import { recolourElementsForTheme } from './theme-graph';
import { getBuiltInTheme } from './themes';

// Layout is the model's call (each product's MCP server spec, §4.3). 'preserve' keeps the coordinates
// it gave (a ring for a cycle, a tree, a grid); 'auto' forces a clean server
// layout; omitted = preserve a real arrangement, but auto-lay-out when the
// model left everything piled at one spot. Either way the connected graph is
// the only thing arranged: edgeless content keeps its place.
export function applyLayout<E extends Element>(
  layout: 'auto' | 'preserve' | undefined,
  elements: E[],
): E[] {
  const shouldLayout =
    layout === 'auto' ? true : layout === 'preserve' ? false : nodesLookUnplaced(elements);
  return shouldLayout && isLayoutCandidate(elements) ? autoLayoutElements(elements) : elements;
}

/** What building a tab reads of a product: its shape-kind coercion, and any settling of the laid-out elements. */
export type TabBuildDeps<E extends Element, K extends string> = {
  coerceShapeKind: (shape: unknown) => K;
  settle?: (elements: E[]) => E[];
};

// Build a finished, persistable tab from validated elements: apply the layout,
// then paint the chosen preset theme onto the elements + the canvas backdrop,
// the same engine the editor uses. `themeId` defaults to brand;
// unknown ids fall back to it. `elements` must already be a valid element list.
export function buildTabWith<E extends Element, K extends string>(
  { coerceShapeKind, settle = (elements) => elements }: TabBuildDeps<E, K>,
  tabId: string,
  name: string,
  elements: E[],
  layout: 'auto' | 'preserve' | undefined,
  themeId: string | undefined,
) {
  const theme = getBuiltInTheme(themeId);
  // Coerce off-vocabulary shape kinds (e.g. a model emitting "rectangle", which
  // isn't a kind: the box is "square") so every node actually renders a box.
  const coerced = elements.map((el) =>
    el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
  );
  // An angled arrow left as an L between ends that face each other bends twice instead (layout-cleanup.md).
  const laidOut = settle(withFacingBends(applyLayout(layout, coerced)));
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
