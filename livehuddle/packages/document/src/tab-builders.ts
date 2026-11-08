// Pure tab builders (livediagram/docs/specs/015-api/mcp-server.md, docs/specs/024-agents/edit-operations.md):
// validated elements turned into a finished, themed, persistable Tab. Render-free, so every caller
// builds tabs the same way. Template tabs are `buildTemplateTab` in @livehuddle/templates.

import { recolourElementsForTheme } from './theme-graph';
import { getBuiltInTheme } from './themes';
import { coerceShapeKind } from './validate';
import type { Element, Tab } from './index';

// Build a finished, persistable Tab from validated elements: paint the chosen preset theme onto the elements and the
// canvas backdrop, with the same engine the editor uses. `themeId` defaults to brand; unknown ids fall back to it.
// `elements` must already be a valid Element[].
export function buildTab(
  tabId: string,
  name: string,
  elements: Element[],
  // Accepted for the api's contract and arranges nothing: the layered layout arranged boxes by the arrows joining
  // them, and arrows are retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 4),
  // so every box keeps the place it was given.
  _layout: 'auto' | 'preserve' | undefined,
  themeId: string | undefined,
): Tab {
  const theme = getBuiltInTheme(themeId);
  // Coerce off-vocabulary shape kinds (e.g. a model emitting "rectangle", which
  // isn't a kind — the box is "square") so every node actually renders a box.
  const coerced = elements.map((el) =>
    el.type === 'shape' ? { ...el, shape: coerceShapeKind(el.shape) } : el,
  );
  return {
    id: tabId,
    name,
    elements: recolourElementsForTheme(coerced, theme),
    theme: theme.id,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
  };
}
