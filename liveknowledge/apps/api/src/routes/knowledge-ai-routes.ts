// The knowledgebase's Ask settings over REST (docs/specs/030-knowledgebase/search-and-ask.md "Ask"):
//   GET    /api/documents/<id>/ai         { hasKey, keyHint, model, models }, never the key
//   PUT    /api/documents/<id>/ai/key     { key }: seal and store it
//   DELETE /api/documents/<id>/ai/key     remove it
//   PUT    /api/documents/<id>/ai/model   { model }
// Reading is every role's (the Ask tab says whether a key is set; the hint is an Editor's). Changing is an Editor's.
import {
  ASK_UNAVAILABLE_WORDS,
  readAiSettings,
  removeStoredAiKey,
  storeAiKey,
  storeAiModel,
} from '../knowledge/ai-settings';
import { forbidden, json, methodNotAllowed, notFound } from '../responses';
import type { KnowledgeRoute } from './knowledge-routes';

const invalid = (error: string, message: string) => json({ error, message }, { status: 400 });

export async function handleAiRoutes({ ctx, document, grant }: KnowledgeRoute): Promise<Response> {
  const { env, request, segments } = ctx;
  const editor = grant.role === 'edit';
  if (segments.length === 4)
    return request.method === 'GET' ? json(await readAiSettings(env, editor)) : methodNotAllowed();
  if (segments.length !== 5 || (segments[4] !== 'key' && segments[4] !== 'model'))
    return notFound();
  if (request.method !== 'PUT' && !(segments[4] === 'key' && request.method === 'DELETE'))
    return methodNotAllowed();
  if (!editor) return forbidden();
  if (request.method === 'DELETE') {
    await removeStoredAiKey(env);
    console.info('[knowledge] ai key removed', { documentId: document.id });
    return json(await readAiSettings(env, true));
  }
  // The body is read here and nowhere logged: for `key` it holds the key.
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (segments[4] === 'model') {
    if (!(await storeAiModel(env, body?.model)))
      return invalid('invalid_model', 'Choose one of the listed Claude models.');
    console.info('[knowledge] ai model set', { documentId: document.id });
    return json(await readAiSettings(env, true));
  }
  const outcome = await storeAiKey(env, document.id, body?.key);
  if (outcome === 'unavailable')
    return json(
      { error: 'ask_unavailable', message: ASK_UNAVAILABLE_WORDS['no-secret'] },
      { status: 503 },
    );
  if (outcome === 'invalid') return invalid('invalid_key', 'That is not an API key.');
  console.info('[knowledge] ai key set', { documentId: document.id });
  return json(await readAiSettings(env, true));
}
