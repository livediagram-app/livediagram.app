// The template door's file (liveworkspace/docs/specs/004-index/kits.md "The apps' door"; docs/specs/015-api/api.md
// "Internal"): one of livediagram's templates as `/new?template=` starts a canvas (its tab, named by the template),
// written as a `.livediagram` file, which the import door's path (internal-file.ts) then reads and makes as the
// owner's canvas, with source `template`.
import { documentToEnvelopeText } from '@livediagram/document';
import { buildTemplateTab, templateKindOf, templateTabName } from '@livediagram/templates';
import { itemFromTemplate, type TemplateFile, type TemplateInput } from '@liveworkspace/index-app';
import { importDocumentFileFor } from './internal-file';
import type { Env } from '../types';

export const templateDocumentFile: TemplateFile = (template, name) => {
  const kind = templateKindOf(template);
  if (!kind) return null;
  const tab = buildTemplateTab('template', templateTabName(kind) ?? name, kind);
  return documentToEnvelopeText({ id: 'template', name, presentation: null }, [tab], Date.now());
};

export const documentFromTemplate = (env: Env, input: TemplateInput) =>
  itemFromTemplate(input, templateDocumentFile, (file) =>
    importDocumentFileFor(env, file, 'template'),
  );
