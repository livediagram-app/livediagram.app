// What a new cloud document is made of (docs/specs/007-editor/new-document-route.md): the template's tab, named after
// its template; or, for no template, one blank tab in the theme's backdrop.
import type { Tab } from '@livehuddle/document';
import { isBlankTemplate, type TemplateKind } from '@livehuddle/templates';
import { buildTemplatedFloorTabs, buildTemplatedTab } from '@/lib/template-builders';
import { templateTabName } from '@/lib/template-tab-name';
import { getTheme } from '@/lib/themes';

// The theme every new document starts in.
export const NEW_DOCUMENT_THEME_ID = 'brand';

// `templateChosen` marks the blank tab as decided (Skip, Start Blank): its start stays closed. A blank the editor
// should open on its start, with the templates, leaves it out.
// `blankOpensOnStart`: a blank template's tab is made empty, so it opens on Start a Space (which shows only on an empty
// tab), and the blank's Avatar Pad lands with whatever is chosen there. Without it a blank template's tab is the Blank
// Space, its pad on it (docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one"): Start Blank.
export function newDocumentTab(input: {
  templateKind: TemplateKind | null;
  themeId: string;
  tabId: string;
  templateChosen?: boolean;
  blankOpensOnStart?: boolean;
}): Tab {
  const { templateKind, themeId, tabId, templateChosen = true, blankOpensOnStart = false } = input;
  if (templateKind && blankOpensOnStart && isBlankTemplate(templateKind)) {
    const built = buildTemplatedTab(templateKind, themeId, tabId, 'Tab 1');
    return { ...built, elements: [] };
  }
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

/**
 * Every tab a new document starts with: newDocumentTab's, then a building template's other floors, one tab each
 * (docs/specs/007-editor/templates-by-mode.md "A template with floors").
 */
export function newDocumentTabs(input: Parameters<typeof newDocumentTab>[0]): Tab[] {
  const first = newDocumentTab(input);
  return input.templateKind
    ? [first, ...buildTemplatedFloorTabs(input.templateKind, input.themeId)]
    : [first];
}
