// The template door's file (liveworkspace/docs/specs/004-index/kits.md "The apps' door"; docs/specs/015-api/api.md
// "Internal"): one of livehuddle's templates as `/new?template=` starts a Space (its first floor named by the
// template, then a tab for each floor after it, on its own floor pattern), written as a `.livehuddle` file, which the
// import door's path (internal-file.ts) then reads and makes as the owner's Space, with source `template`.
import {
  buildTab,
  documentToEnvelopeText,
  screenFileOfSeed,
  stampTabKind,
  withScreenFile,
} from '@livehuddle/document';
import {
  buildTemplateTab,
  templateCanvasOverrides,
  templateFloors,
  templateKindOf,
  templateTabName,
} from '@livehuddle/templates';
import { itemFromTemplate, type TemplateFile, type TemplateInput } from '@liveworkspace/index-app';
import { importDocumentFileFor } from './internal-file';
import type { Env } from '../types';

export const templateDocumentFile: TemplateFile = (template, name, options) => {
  const kind = templateKindOf(template);
  if (!kind) return null;
  const built = buildTemplateTab('template', templateTabName(kind) ?? name, kind);
  // A file for the Space's Screens (kits.md "The apps' door" `screen`, Work Tracker 1427): a call's Document Room
  // opens with the call's item on its wall.
  const file = screenFileOfSeed(options?.screen);
  const first = file ? { ...built, elements: withScreenFile(built.elements, file) } : built;
  const floors = templateFloors(kind).map((floor) =>
    stampTabKind({
      ...buildTab(crypto.randomUUID(), floor.name, floor.build(0, 0), 'preserve', undefined),
      templateChosen: true,
      ...templateCanvasOverrides(kind),
      backgroundPattern: floor.floor,
    }),
  );
  return documentToEnvelopeText(
    { id: 'template', name, presentation: null },
    [first, ...floors],
    Date.now(),
  );
};

export const documentFromTemplate = (env: Env, input: TemplateInput) =>
  itemFromTemplate(input, templateDocumentFile, (file) =>
    importDocumentFileFor(env, file, 'template'),
  );
