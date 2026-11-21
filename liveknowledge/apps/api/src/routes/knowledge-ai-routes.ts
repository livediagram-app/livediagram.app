// The knowledgebase's AI settings over REST (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Providers"):
//   GET    /api/documents/<id>/ai         { provider, hasKey, keyHint, model, models, providers, builtIn, uses,
//                                          usesModel? }, never a key
//   PUT    /api/documents/<id>/ai/key     { provider, key }: seal and store it; another provider replaces the key
//   DELETE /api/documents/<id>/ai/key     remove it
//   PUT    /api/documents/<id>/ai/model   { model }: one of the stored provider's
// Reading is every role's (the Ask tab says whether a key is set; the hint is an Editor's). Changing is an Editor's.
import {
  ASK_UNAVAILABLE_WORDS,
  askerOf,
  readAiSettings,
  whichAi,
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
  if (segments.length === 4) {
    if (request.method !== 'GET') return methodNotAllowed();
    // Which key answers this asker too (search-and-ask.md "Which key answers"): one call to accounts, only when the
    // knowledgebase has no key of its own, and never the key.
    const settings = await readAiSettings(env, editor);
    return json({ ...settings, ...(await whichAi(env, settings, askerOf(ctx, document.teamId))) });
  }
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
      return invalid('invalid_model', 'Choose one of the listed models.');
    console.info('[knowledge] ai model set', { documentId: document.id });
    return json(await readAiSettings(env, true));
  }
  const outcome = await storeAiKey(env, document.id, body?.provider, body?.key);
  if (outcome === 'invalid-provider')
    return invalid('invalid_provider', 'Choose Anthropic or OpenAI.');
  if (outcome === 'unavailable')
    return json(
      { error: 'ask_unavailable', message: ASK_UNAVAILABLE_WORDS['no-secret'] },
      { status: 503 },
    );
  if (outcome === 'invalid') return invalid('invalid_key', 'That is not an API key.');
  console.info('[knowledge] ai key set', { documentId: document.id });
  return json(await readAiSettings(env, true));
}
