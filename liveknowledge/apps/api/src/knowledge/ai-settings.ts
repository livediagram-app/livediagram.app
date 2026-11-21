// The knowledgebase's AI settings in its room (docs/specs/030-knowledgebase/search-and-ask.md "Ask", "Providers"):
// the team's own key for one provider, sealed under the Worker's `AI_KEY_SECRET` and bound to this knowledgebase's
// id, with its hint, its provider and the chosen model. The key leaves this module in plain form only towards
// `callModel`; no log line, error or response holds it.
import {
  KeySealError,
  SETTING_AI_KEY,
  SETTING_AI_KEY_HINT,
  SETTING_AI_MODEL,
  SETTING_AI_PROVIDER,
  keyHint,
  openApiKey,
  putAiKey,
  putSetting,
  readSetting,
  removeAiKey,
  removeAiModel,
  sealApiKey,
} from '@liveknowledge/knowledge';
import {
  MODEL_PROVIDERS,
  isModelProviderId,
  isProviderModel,
  modelProvider,
  providerModel,
  type KeyProviderId,
} from '@liveworkspace/ai';
import type { KnowledgeAiSettings } from '@liveknowledge/api-schema';
import type { DocumentEnv } from '../types';
import { rowsOf, runAll } from './knowledge-db';
import { builtInAi } from './setup-built-in-ai';

const settingOf = async (env: DocumentEnv, name: string): Promise<string | null> =>
  (await rowsOf<{ value: string }>(env, readSetting(name)))[0]?.value ?? null;

/** The provider the knowledgebase's key is for. No row (a key kept before there was a choice) is Anthropic. */
const storedProvider = async (env: DocumentEnv): Promise<KeyProviderId> =>
  modelProvider(await settingOf(env, SETTING_AI_PROVIDER)).id;

/** What AI Settings and the Ask tab read. `withHint`: an Editor's read; anyone else learns only that a key is set. */
export async function readAiSettings(
  env: DocumentEnv,
  withHint: boolean,
): Promise<KnowledgeAiSettings> {
  const [envelope, hint, model, provider] = await Promise.all([
    settingOf(env, SETTING_AI_KEY),
    settingOf(env, SETTING_AI_KEY_HINT),
    settingOf(env, SETTING_AI_MODEL),
    storedProvider(env),
  ]);
  return {
    provider,
    hasKey: envelope !== null,
    keyHint: withHint && envelope !== null ? (hint ?? '') : '',
    model: providerModel(provider, model).id,
    models: modelProvider(provider).models.map(({ id, name }) => ({ id, label: name })),
    providers: MODEL_PROVIDERS.map(({ id, name, keyPrefix }) => ({ id, label: name, keyPrefix })),
    builtIn: builtInAi(env) !== null,
  };
}

export type KeyOutcome = 'stored' | 'unavailable' | 'invalid' | 'invalid-provider';

/** Seal and store the key with its provider. No provider sent: the one already stored. Another provider than the
 *  stored one replaces the key and forgets the model, in the same transaction. `unavailable`: this deployment has
 *  no `AI_KEY_SECRET`, so it keeps no key. */
export async function storeAiKey(
  env: DocumentEnv,
  documentId: string,
  provider: unknown,
  apiKey: unknown,
): Promise<KeyOutcome> {
  if (!env.AI_KEY_SECRET) return 'unavailable';
  if (provider !== undefined && !isModelProviderId(provider)) return 'invalid-provider';
  if (typeof apiKey !== 'string') return 'invalid';
  const key = apiKey.trim();
  const before = await storedProvider(env);
  const chosen = provider ?? before;
  try {
    await runAll(env, [
      ...putAiKey(await sealApiKey(env.AI_KEY_SECRET, key, documentId), keyHint(key), chosen),
      ...(chosen === before ? [] : [removeAiModel()]),
    ]);
    return 'stored';
  } catch (error) {
    if (error instanceof KeySealError) return 'invalid';
    throw error;
  }
}

export const removeStoredAiKey = (env: DocumentEnv): Promise<void> => runAll(env, [removeAiKey()]);

/** Store the model; false for an id that is not one of the stored provider's. */
export async function storeAiModel(env: DocumentEnv, model: unknown): Promise<boolean> {
  if (!isProviderModel(await storedProvider(env), model)) return false;
  await runAll(env, [putSetting(SETTING_AI_MODEL, model as string)]);
  return true;
}

export type OpenedAi = { provider: KeyProviderId; apiKey: string; model: string };

/** The key in plain form with its provider and model, for a call; `no-secret`, `no-key` or `unreadable` when no
 *  model can be called. */
export async function openAi(
  env: DocumentEnv,
  documentId: string,
): Promise<OpenedAi | 'no-secret' | 'no-key' | 'unreadable'> {
  if (!env.AI_KEY_SECRET) return 'no-secret';
  const envelope = await settingOf(env, SETTING_AI_KEY);
  if (envelope === null) return 'no-key';
  try {
    const apiKey = await openApiKey(env.AI_KEY_SECRET, envelope, documentId);
    const provider = await storedProvider(env);
    const model = providerModel(provider, await settingOf(env, SETTING_AI_MODEL)).id;
    return { provider, apiKey, model };
  } catch {
    // Whatever the reason, only that it did not open: never the envelope or the secret.
    return 'unreadable';
  }
}

/** The words for a knowledgebase no model can be called in: no key and no built-in AI (`no-secret`, `no-key`), or a
 *  stored key that does not open (never swapped for built-in AI). */
export const ASK_UNAVAILABLE_WORDS = {
  'no-secret': "Built-in AI isn't set up on this server, and it keeps no key.",
  'no-key':
    "Built-in AI isn't set up on this server. An Editor can add your team's AI key in AI Settings.",
  unreadable: "Your team's stored AI key could not be read. Replace it in AI Settings.",
} as const;
