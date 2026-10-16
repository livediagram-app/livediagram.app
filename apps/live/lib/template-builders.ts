// The editor-side seam over @livediagram/templates: the pure builders
// live in the package (shared with the MCP worker, docs/specs/015-api/mcp-server.md); this
// wrapper adds what only the app can — resolving the theme id (which
// may be a custom `custom:<uuid>` id, docs/specs/011-theme/custom-themes.md) and the graph-aware
// theme recolour — to land a picked template as a fully styled tab.
// editor-page dynamic-imports this module inside the onChooseTemplate
// callback so the builders stay out of the editor's initial bundle;
// /live/new imports it statically since it's the template-creation
// page by definition.

import { type Tab } from '@livediagram/document';
import {
  templateCanvasOverrides,
  templateTabs,
  withBlankPageThemed,
  type TemplateKind,
  type TemplateTabDef,
} from '@livediagram/templates';
import { getTheme, recolourElementsForTheme } from './themes';

export {
  buildTemplate,
  isDefaultDocumentName,
  templateCanvasOverrides,
  templateTabs,
  untitledNameForTemplate,
} from '@livediagram/templates';

export function buildTemplatedTab(
  kind: TemplateKind,
  // string, not ThemeId: may be a custom `custom:<uuid>` id (docs/specs/011-theme/custom-themes.md),
  // which getTheme resolves via the custom-theme registry.
  themeId: string,
  tabId: string,
  tabName: string,
): Tab {
  return themedTab(templateTabs(kind)[0]!, kind, themeId, tabId, tabName, [tabId]);
}

// Every tab a template makes (docs/specs/026-plan/plan-templates.md "How a template with tabs is made"):
// the first takes `tabId` and `tabName` (unless the template names it), the rest a fresh id each and
// the template's names.
export function buildTemplatedTabs(
  kind: TemplateKind,
  themeId: string,
  tabId: string,
  tabName: string,
  newId: () => string = () => crypto.randomUUID(),
): Tab[] {
  const defs = templateTabs(kind);
  const ids = defs.map((_, i) => (i === 0 ? tabId : newId()));
  return defs.map((def, i) => themedTab(def, kind, themeId, ids[i]!, def.name ?? tabName, ids));
}

function themedTab(
  def: TemplateTabDef,
  kind: TemplateKind,
  themeId: string,
  tabId: string,
  tabName: string,
  // Every tab's id in order, for a template whose tabs name each other (a Plan Dashboard's slots).
  ids: readonly string[],
): Tab {
  const theme = getTheme(themeId);
  // Graph-aware recolour so multi-colour themes (docs/specs/011-theme/multicolour-themes.md) can tint each
  // branch of the scaffold a distinct hue; single-colour themes fall
  // straight through to the per-element transform.
  const elements = recolourElementsForTheme(def.build(0, 0), theme);
  return withBlankPageThemed(
    {
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
      ...def.tab?.(ids),
    },
    kind,
    theme,
  );
}
