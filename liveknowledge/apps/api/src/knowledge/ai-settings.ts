// The knowledgebase's Ask settings in its room (docs/specs/030-knowledgebase/search-and-ask.md "Ask"): the team's
// Claude API key, sealed under the Worker's `AI_KEY_SECRET` and bound to this knowledgebase's id, its hint and the
// chosen model. The key leaves this module in plain form only towards `callClaude`; no log line, error or response
// holds it.
import {
  CLAUDE_MODELS,
  KeySealError,
  SETTING_AI_KEY,
  SETTING_AI_KEY_HINT,
  SETTING_AI_MODEL,
  claudeModel,
  keyHint,
  openApiKey,
  putAiKey,
  putSetting,
  readSetting,
  removeAiKey,
  sealApiKey,
} from '@liveknowledge/knowledge';
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { rowsOf, runAll } from './knowledge-db';

const settingOf = async (env: DocumentEnv, name: string): Promise<string | null> =>
  (await rowsOf<{ value: string }>(env, readSetting(name)))[0]?.value ?? null;

/** What Settings and the Ask tab read. `withHint`: an Editor's read; anyone else learns only that a key is set. */
export async function readAiSettings(
  env: DocumentEnv,
  withHint: boolean,
): Promise<KnowledgeAiSettings> {
  const [envelope, hint, model] = await Promise.all([
    settingOf(env, SETTING_AI_KEY),
    settingOf(env, SETTING_AI_KEY_HINT),
    settingOf(env, SETTING_AI_MODEL),
  ]);
  return {
    hasKey: envelope !== null,
    keyHint: withHint && envelope !== null ? (hint ?? '') : '',
    model: claudeModel(model).id,
    models: CLAUDE_MODELS.map(({ id, name }) => ({ id, label: name })),
  };
}

export type KeyOutcome = 'stored' | 'unavailable' | 'invalid';

/** Seal and store the key. `unavailable`: this deployment has no `AI_KEY_SECRET`, so it keeps no key. */
export async function storeAiKey(
  env: DocumentEnv,
  documentId: string,
  apiKey: unknown,
): Promise<KeyOutcome> {
  if (!env.AI_KEY_SECRET) return 'unavailable';
  if (typeof apiKey !== 'string') return 'invalid';
  const key = apiKey.trim();
  try {
    await runAll(env, putAiKey(await sealApiKey(env.AI_KEY_SECRET, key, documentId), keyHint(key)));
    return 'stored';
  } catch (error) {
    if (error instanceof KeySealError) return 'invalid';
    throw error;
  }
}

export const removeStoredAiKey = (env: DocumentEnv): Promise<void> => runAll(env, [removeAiKey()]);

/** Store the model; false for an id that is none of the list. */
export async function storeAiModel(env: DocumentEnv, model: unknown): Promise<boolean> {
  if (!CLAUDE_MODELS.some((m) => m.id === model)) return false;
  await runAll(env, [putSetting(SETTING_AI_MODEL, model as string)]);
  return true;
}

export type OpenedAi = { apiKey: string; model: string };

/** The key in plain form and the model, for a call; `no-secret`, `no-key` or `unreadable` when Ask cannot run. */
export async function openAi(
  env: DocumentEnv,
  documentId: string,
): Promise<OpenedAi | 'no-secret' | 'no-key' | 'unreadable'> {
  if (!env.AI_KEY_SECRET) return 'no-secret';
  const envelope = await settingOf(env, SETTING_AI_KEY);
  if (envelope === null) return 'no-key';
  try {
    const apiKey = await openApiKey(env.AI_KEY_SECRET, envelope, documentId);
    return { apiKey, model: claudeModel(await settingOf(env, SETTING_AI_MODEL)).id };
  } catch {
    // Whatever the reason, only that it did not open: never the envelope or the secret.
    return 'unreadable';
  }
}

/** The words for a knowledgebase Ask cannot run in. */
export const ASK_UNAVAILABLE_WORDS = {
  'no-secret': 'Ask is not set up on this server.',
  'no-key': 'Ask needs a Claude API key. An Editor can add one in Settings.',
  unreadable: 'The stored Claude API key could not be read. Replace it in Settings.',
} as const;
