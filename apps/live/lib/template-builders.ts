// The editor-side seam over @livediagram/templates: the pure builders
// live in the package (shared with the MCP worker, spec/62); this
// wrapper adds what only the app can — resolving the theme id (which
// may be a custom `custom:<uuid>` id, spec/44) and the graph-aware
// theme recolour — to land a picked template as a fully styled tab.
// editor-page dynamic-imports this module inside the onChooseTemplate
// callback so the builders stay out of the editor's initial bundle;
// /live/new imports it statically since it's the template-creation
// page by definition.

import { type Tab } from '@livediagram/diagram';
import { buildTemplate, templateCanvasOverrides, type TemplateKind } from '@livediagram/templates';
import { getTheme, recolourElementsForTheme } from './themes';

export { buildTemplate } from '@livediagram/templates';

export function buildTemplatedTab(
  kind: TemplateKind,
  // string, not ThemeId: may be a custom `custom:<uuid>` id (spec/44),
  // which getTheme resolves via the custom-theme registry.
  themeId: string,
  tabId: string,
  tabName: string,
): Tab {
  const theme = getTheme(themeId);
  const rawElements = buildTemplate(kind, 0, 0);
  // Graph-aware recolour so multi-colour themes (spec/29) can tint each
  // branch of the scaffold a distinct hue; single-colour themes fall
  // straight through to the per-element transform.
  const elements = recolourElementsForTheme(rawElements, theme);
  return {
    id: tabId,
    name: tabName,
    elements,
    theme: themeId,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
    templateChosen: true,
    ...templateCanvasOverrides(kind),
  };
}
