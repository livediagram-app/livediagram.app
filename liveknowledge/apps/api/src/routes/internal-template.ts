// The template door's file (liveworkspace/docs/specs/004-index/kits.md "The apps' door"; docs/specs/015-api/api.md
// "Internal"): one of liveknowledge' templates as `/new?template=` starts a document (every tab it makes, the first
// named by the template), written as a `.liveknowledge` file, which the import door's path (internal-file.ts) then
// reads and makes as the owner's document, with source `template`.
import { documentToEnvelopeText } from '@liveknowledge/document';
import { buildTemplateTabs, templateKindOf, templateTabName } from '@liveknowledge/templates';
import { itemFromTemplate, type TemplateFile, type TemplateInput } from '@liveworkspace/index-app';
import { importDocumentFileFor } from './internal-file';
import type { Env } from '../types';

export const templateDocumentFile: TemplateFile = (template, name) => {
  const kind = templateKindOf(template);
  if (!kind) return null;
  const tabs = buildTemplateTabs(
    { id: 'template', name: templateTabName(undefined, kind) },
    kind,
    () => crypto.randomUUID(),
  );
  return documentToEnvelopeText({ id: 'template', name, presentation: null }, tabs, Date.now());
};

export const documentFromTemplate = (env: Env, input: TemplateInput) =>
  itemFromTemplate(input, templateDocumentFile, (file) =>
    importDocumentFileFor(env, file, 'template'),
  );
