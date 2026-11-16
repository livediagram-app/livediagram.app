// The template door's file (liveworkspace/docs/specs/004-index/kits.md "The apps' door"; docs/specs/015-api/api.md
// "Internal"): one of liveplanner's templates as `/new?template=` starts a plan (lib/new-project-content.ts), written
// as a `.liveplanner` file, which the import door's path (internal-file.ts) then reads and makes as the owner's plan,
// with source `template`: every tab the template makes, the card types its boards bring, its example cards and its
// Sheets made from their marks. The door cannot name the person, so the example cards are made by the example team's
// Maya, as an offline plan's are before its maker is known. A form template is made only by the editor, so it has no
// file.
import { projectToEnvelopeText, type EnvelopeSheet } from '@liveplanner/project';
import { catalogueWithBoardTypes, itemPlacer, makeItem, type Item, provideTemplateCardTypes } from '@liveplanner/items';
import {
  buildTemplateTabs,
  hasTemplateSheets,
  isFormTemplateKind,
  templateKindOf,
  templateTabName,
} from '@liveplanner/templates';
import {
  planTemplateSeedItems,
  seedPerson,
  seedToday,
} from '@liveplanner/templates/plan-template-seeds';
import { materialiseTemplateSheets } from '@liveplanner/templates/template-sheets';
import { itemFromTemplate, type TemplateFile, type TemplateInput } from '@liveworkspace/index-app';
import { importProjectFileFor } from './internal-file';
import type { Env } from '../types';
import { TEMPLATE_CARD_TYPES } from '@liveplanner/items/template-card-types';

// The Plan templates' own card types, so the template it makes can bring them (docs/specs/026-plan/plan-templates.md "Card
// types a template makes"). A subpath, kept out of the editor's first load.
provideTemplateCardTypes(TEMPLATE_CARD_TYPES);

// A template's example cards as the file carries them: numbered from 1, placed in their columns in order.
function exampleCards(kind: Parameters<typeof planTemplateSeedItems>[0], now: number): Item[] {
  const by = seedPerson('maya');
  const placer = itemPlacer([]);
  return planTemplateSeedItems(kind, seedToday(new Date(now))).map((create, i) => {
    const item = makeItem(create, { now, by, id: create.id!, key: i + 1, items: placer });
    placer.add(item);
    return item;
  });
}

export const templateProjectFile: TemplateFile = (template, name) => {
  const kind = templateKindOf(template);
  if (!kind || isFormTemplateKind(kind)) return null;
  const now = Date.now();
  let tabs = buildTemplateTabs(
    { id: 'template', name: templateTabName(undefined, kind) },
    kind,
    () => crypto.randomUUID(),
  );
  const itemTypes = catalogueWithBoardTypes(
    null,
    tabs.flatMap((tab) => tab.elements),
  );
  let sheets: EnvelopeSheet[] = [];
  if (hasTemplateSheets(tabs)) {
    const made = materialiseTemplateSheets(tabs, now);
    tabs = made.tabs;
    sheets = made.sheets as EnvelopeSheet[];
  }
  const items = exampleCards(kind, now);
  return projectToEnvelopeText({ id: 'template', name }, tabs, now, items, itemTypes, sheets);
};

export const projectFromTemplate = (env: Env, input: TemplateInput) =>
  itemFromTemplate(input, templateProjectFile, (file) =>
    importProjectFileFor(env, file, 'template'),
  );
