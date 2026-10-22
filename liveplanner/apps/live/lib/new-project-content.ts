// What a new cloud project is made of (docs/specs/007-editor/new-project-route.md): the template's tabs, the
// first named after its template unless the template names it, the card types its boards use, and a Plan
// template's example cards; or, for no template, one blank tab in the theme's backdrop. Shared by /new and the
// workspace frame's New project (docs/specs/013-workspace/blueprints/workbench-embeds.md, WB58), so a project
// made in either is the same project.
import type { Tab } from '@liveplanner/project';
import {
  catalogueWithBoardTypes,
  type ItemCreate,
  type ItemTypeCatalogue,
} from '@liveplanner/items';
import {
  formTemplateStarter,
  isFormTemplateKind,
  isPlanTemplateKind,
  type TemplateKind,
} from '@liveplanner/templates';
import { debugLog } from '@/lib/debug-log';
import { markPendingFormStart } from '@/lib/pending-form-start';
import { buildTemplatedTabs } from '@/lib/template-builders';
import { templateTabName } from '@/lib/template-tab-name';
import { getTheme } from '@/lib/themes';

// The theme every new project starts in.
export const NEW_PROJECT_THEME_ID = 'brand';

export type NewProjectContent = {
  // The template's tabs, or null for no template.
  tabs: Tab[] | null;
  // The tab that opens: the template's first, or the blank one.
  tab: Tab;
  itemTypes: ItemTypeCatalogue | null;
  seedItems: ItemCreate[];
};

// `templateChosen` marks the blank tab as decided (Skip, Start Blank): its start stays closed. A blank the editor
// should open on its start, with the templates, leaves it out.
export async function newProjectContent(input: {
  templateKind: TemplateKind | null;
  themeId: string;
  tabId: string;
  via: string;
  templateChosen?: boolean;
}): Promise<NewProjectContent> {
  const { templateKind, themeId, tabId, via, templateChosen = true } = input;
  // A template may make several tabs (docs/specs/026-plan/plan-templates.md); the first opens.
  const built = templateKind ? buildTemplatedTabs(templateKind, themeId, tabId, 'Tab 1') : null;
  // A form template: the editor starts its form on the tab once it opens (lib/pending-form-start.ts).
  if (templateKind && isFormTemplateKind(templateKind))
    markPendingFormStart(tabId, formTemplateStarter(templateKind));
  // The first tab is named after its template unless the template names it (template-tab-name.ts).
  const tabs =
    built && templateKind && built[0]!.name === 'Tab 1'
      ? [
          { ...built[0]!, name: templateTabName(templateKind, built[0]!) ?? 'Tab 1' },
          ...built.slice(1),
        ]
      : built;
  // A Plan template's boards bring their card types (docs/specs/026-plan/plan-templates.md "Card types a template
  // uses"): the project is made with them. Null (the default types) for every other template.
  const itemTypes = tabs
    ? catalogueWithBoardTypes(
        null,
        tabs.flatMap((t) => t.elements),
      )
    : null;
  if (itemTypes) debugLog('[item-types] brought', { types: itemTypes.types.length, via });
  // Its worked example cards, dated from today (docs/specs/026-plan/plan-templates.md "Example cards"): none for
  // any template but a Plan template with boards. Loaded only for a Plan template, so their data stays out of the
  // first load.
  const seedItems =
    templateKind && isPlanTemplateKind(templateKind)
      ? await import('@liveplanner/templates/plan-template-seeds').then((m) =>
          m.planTemplateSeedItems(templateKind, m.seedToday()),
        )
      : [];
  if (seedItems.length) debugLog('[plan] seed cards', { cards: seedItems.length, via });
  const theme = getTheme(themeId);
  const tab: Tab = tabs
    ? tabs[0]!
    : {
        // A blank tab with the theme's backdrop, so the editor opens it on Start Planning with no seeded elements.
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
  return { tabs, tab, itemTypes, seedItems };
}
