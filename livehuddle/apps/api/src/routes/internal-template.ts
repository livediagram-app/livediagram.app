// The template door's file (liveworkspace/docs/specs/004-index/kits.md "The apps' door"; docs/specs/015-api/api.md
// "Internal"): one of livehuddle's templates as `/new?template=` starts a Space (its first floor named by the
// template, then a tab for each floor after it, on its own floor pattern), written as a `.livehuddle` file, which the
// import door's path (internal-file.ts) then reads and makes as the owner's Space, with source `template`.
import { buildTab, documentToEnvelopeText, stampTabKind } from '@livehuddle/document';
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

export const templateDocumentFile: TemplateFile = (template, name) => {
  const kind = templateKindOf(template);
  if (!kind) return null;
  const first = buildTemplateTab('template', templateTabName(kind) ?? name, kind);
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
