// The apps' template door (liveworkspace/docs/specs/004-index/kits.md "The apps' door";
// POST /api/internal/items/from-template, the index's key alone): a new item for `owner`, in `folderId`, from one of
// the app's templates, a project kit's part. It is the Drive import's path with the file built from the template, so
// every check, limit and undo the import has applies: the app hands in the file of a template (its envelope text, as
// its `/new?template=` would start the item) and its import, run with source `template`.

import { KIT_TEMPLATE_MAX } from '@liveworkspace/index-client';
import type {
  ImportInput,
  ImportResult,
  InternalItemHandlers,
  TemplateInput,
  TemplateResult,
} from './internal-contract';
import { IMPORT_NAME_MAX } from './internal-contract';
import { USER_ID, badRequest, bodyOf, json, validId } from './internal-doors';

// The template's file, named `name`, or null for a kind the app has no template of.
export type TemplateFile = (template: string, name: string) => string | null;

// The app's import, as its import door runs it, with source `template`.
export type TemplateImport = (input: ImportInput) => Promise<ImportResult>;

export async function itemFromTemplate(
  input: TemplateInput,
  fileOf: TemplateFile,
  runImport: TemplateImport,
): Promise<TemplateResult> {
  const file = fileOf(input.template, input.name);
  if (file === null) return { status: 'unknown_template' };
  const { owner, folderId, name } = input;
  const result = await runImport({ owner, folderId, name, file });
  // A template the app's own reader refuses is the app's bug, never the caller's: a 503, logged.
  if (result.status !== 'ok') throw new Error(`template_${result.status}`);
  return result;
}

// POST /api/internal/items/from-template: the body checked, then the app's handler.
export async function templateDoor(
  request: Request,
  run: NonNullable<InternalItemHandlers['fromTemplate']>,
): Promise<Response> {
  const body = await bodyOf(request);
  if (!body) return badRequest('body must be a JSON object');
  const { owner, folderId, name, template } = body;
  if (typeof owner !== 'string' || !USER_ID.test(owner))
    return badRequest('owner must be an account id');
  if (folderId !== null && !validId(folderId))
    return badRequest('folderId must be a folder id or null');
  if (typeof name !== 'string' || !name.trim() || name.length > IMPORT_NAME_MAX)
    return badRequest('name must be a name');
  if (typeof template !== 'string' || !template || template.length > KIT_TEMPLATE_MAX)
    return badRequest('template must be a template kind');
  let result: TemplateResult;
  try {
    result = await run({ owner, folderId, name: name.trim(), template });
  } catch (err) {
    console.error('[internal] template item failed', { template, error: String(err) });
    return json({ error: 'unavailable' }, 503);
  }
  if (result.status === 'unknown_template') {
    console.warn('[internal] template item refused', { template });
    return json({ error: 'unknown_template' }, 404);
  }
  console.info('[internal] template item made', { id: result.id, template });
  return json({ id: result.id }, 201);
}
