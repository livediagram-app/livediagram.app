// The template door's file (liveworkspace/docs/specs/004-index/kits.md "The apps' door"; docs/specs/015-api/api.md
// "Internal"): one of livedesign's templates as `/new?template=` starts a design (every tab it makes, the first named
// by the template), written as a `.livedesign` file, which the import door's path (internal-file.ts) then reads and
// makes as the owner's design, with source `template`.
import { designToEnvelopeText } from '@livedesign/design';
import { buildTemplateTabs, templateKindOf, templateTabName } from '@livedesign/templates';
import { itemFromTemplate, type TemplateFile, type TemplateInput } from '@liveworkspace/index-app';
import { importDesignFileFor } from './internal-file';
import type { Env } from '../types';

export const templateDesignFile: TemplateFile = (template, name) => {
  const kind = templateKindOf(template);
  if (!kind) return null;
  const tabs = buildTemplateTabs(
    { id: 'template', name: templateTabName(undefined, kind) },
    kind,
    () => crypto.randomUUID(),
  );
  return designToEnvelopeText({ id: 'template', name }, tabs, Date.now());
};

export const designFromTemplate = (env: Env, input: TemplateInput) =>
  itemFromTemplate(input, templateDesignFile, (file) => importDesignFileFor(env, file, 'template'));
