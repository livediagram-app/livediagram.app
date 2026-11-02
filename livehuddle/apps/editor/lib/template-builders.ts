// The editor-side seam over @livehuddle/templates: the pure builders
// live in the package (shared with the MCP worker, docs/specs/015-api/mcp-server.md); this
// wrapper adds what only the app can — resolving the theme id in the
// viewer's appearance and the graph-aware theme recolour — to land a picked template as a fully styled tab.
// editor-page dynamic-imports this module inside the onChooseTemplate
// callback so the builders stay out of the editor's initial bundle;
// /live/new imports it statically since it's the template-creation
// page by definition.

import { type Tab } from '@livehuddle/document';
import { buildTemplate, templateCanvasOverrides, type TemplateKind } from '@livehuddle/templates';
import { getTheme, recolourElementsForTheme } from './themes';

export {
  buildTemplate,
  isDefaultDocumentName,
  templateCanvasOverrides,
  untitledNameForTemplate,
} from '@livehuddle/templates';

export function buildTemplatedTab(
  kind: TemplateKind,
  themeId: string,
  tabId: string,
  tabName: string,
): Tab {
  const theme = getTheme(themeId);
  // Graph-aware recolour so multi-colour themes (docs/specs/011-theme/multicolour-themes.md) can tint each
  // branch of the scaffold a distinct hue; single-colour themes fall
  // straight through to the per-element transform.
  const elements = recolourElementsForTheme(buildTemplate(kind, 0, 0), theme);
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
