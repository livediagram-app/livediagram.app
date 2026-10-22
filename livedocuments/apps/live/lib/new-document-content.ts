// What a new cloud document is made of (docs/specs/007-editor/new-document-route.md): the template's tabs, the
// first named after its template unless the template names it; or, for no template, one blank tab in the theme's
// backdrop. Shared by /new and the
// workspace frame's New document (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB58), so a document
// made in either is the same document.
import type { Tab } from '@livedocuments/document';
import type { TemplateKind } from '@livedocuments/templates';
import { buildTemplatedTabs } from '@/lib/template-builders';
import { templateTabName } from '@/lib/template-tab-name';
import { getTheme } from '@/lib/themes';

// The theme every new document starts in.
export const NEW_DOCUMENT_THEME_ID = 'brand';

export type NewDocumentContent = {
  // The template's tabs, or null for no template.
  tabs: Tab[] | null;
  // The tab that opens: the template's first, or the blank one.
  tab: Tab;
};

// `templateChosen` marks the blank tab as decided (Skip, Start Blank): its start stays closed. A blank the editor
// should open on its start, with the templates, leaves it out.
export async function newDocumentContent(input: {
  templateKind: TemplateKind | null;
  themeId: string;
  tabId: string;
  templateChosen?: boolean;
}): Promise<NewDocumentContent> {
  const { templateKind, themeId, tabId, templateChosen = true } = input;
  // A template makes its tabs; the first opens.
  const built = templateKind ? buildTemplatedTabs(templateKind, themeId, tabId, 'Tab 1') : null;
  // The first tab is named after its template unless the template names it (template-tab-name.ts).
  const tabs =
    built && templateKind && built[0]!.name === 'Tab 1'
      ? [{ ...built[0]!, name: templateTabName(templateKind) ?? 'Tab 1' }, ...built.slice(1)]
      : built;
  const theme = getTheme(themeId);
  const tab: Tab = tabs
    ? tabs[0]!
    : {
        // A blank canvas with the theme's backdrop, so the editor loads in the person's style with no seeded
        // elements.
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
  return { tabs, tab };
}
