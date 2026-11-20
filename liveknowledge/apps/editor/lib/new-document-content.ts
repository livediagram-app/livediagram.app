// What a new cloud document is made of (docs/specs/007-editor/new-document-route.md): the template's tabs, the
// first named after its template unless the template names it; or, for no template, one blank tab in the theme's
// backdrop. Shared by /new and the
// workspace frame's New document (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB58), so a document
// made in either is the same document.
import { newKnowledgebasePageContent, START_PAGE_NAME, type Tab } from '@liveknowledge/document';
import type { TemplateKind } from '@liveknowledge/templates';
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
  const { templateKind, themeId, tabId } = input;
  // A template makes its tabs; the first opens.
  const built = templateKind
    ? buildTemplatedTabs(templateKind, themeId, tabId, START_PAGE_NAME)
    : null;
  // The first tab is named after its template unless the template names it (template-tab-name.ts).
  const tabs =
    built && templateKind && built[0]!.name === START_PAGE_NAME
      ? [
          { ...built[0]!, name: templateTabName(templateKind) ?? START_PAGE_NAME },
          ...built.slice(1),
        ]
      : built;
  const theme = getTheme(themeId);
  const tab: Tab = tabs
    ? tabs[0]!
    : {
        // One page to write on, Start Here (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "A
        // knowledgebase"), on the theme's backdrop.
        id: tabId,
        name: START_PAGE_NAME,
        elements: [],
        theme: themeId,
        backgroundColor: theme.backgroundColor,
        backgroundPattern: theme.backgroundPattern,
        patternColor: theme.patternColor,
        ...(theme.backgroundOpacity != null ? { backgroundOpacity: theme.backgroundOpacity } : {}),
        templateChosen: true,
        ...newKnowledgebasePageContent(),
      };
  return { tabs, tab };
}
