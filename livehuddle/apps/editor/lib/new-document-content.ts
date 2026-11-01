// What a new cloud document is made of (docs/specs/007-editor/new-document-route.md): the template's tab, named after
// its template; or, for no template, one blank tab in the theme's backdrop. Shared by /new and the workspace frame's
// New document (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB58), so a document made in either is the
// same document.
import type { Tab } from '@livediagram/document';
import type { TemplateKind } from '@livediagram/templates';
import { buildTemplatedTab } from '@/lib/template-builders';
import { templateTabName } from '@/lib/template-tab-name';
import { getTheme } from '@/lib/themes';

// The theme every new document starts in.
export const NEW_DOCUMENT_THEME_ID = 'brand';

// `templateChosen` marks the blank tab as decided (Skip, Start Blank): its start stays closed. A blank the editor
// should open on its start, with the templates, leaves it out.
export function newDocumentTab(input: {
  templateKind: TemplateKind | null;
  themeId: string;
  tabId: string;
  templateChosen?: boolean;
}): Tab {
  const { templateKind, themeId, tabId, templateChosen = true } = input;
  if (templateKind) {
    const built = buildTemplatedTab(templateKind, themeId, tabId, 'Tab 1');
    return { ...built, name: templateTabName(templateKind) ?? 'Tab 1' };
  }
  const theme = getTheme(themeId);
  // A blank canvas with the theme's backdrop, so the editor loads in the person's style with no seeded elements.
  return {
    id: tabId,
    name: 'Tab 1',
    elements: [],
    theme: themeId,
    backgroundColor: theme.backgroundColor,
    backgroundPattern: theme.backgroundPattern,
    patternColor: theme.patternColor,
    ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
    ...(templateChosen ? { templateChosen: true } : {}),
  };
}
