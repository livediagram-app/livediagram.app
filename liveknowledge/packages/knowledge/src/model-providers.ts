// The providers a team may bring a key for (docs/specs/030-knowledgebase/search-and-ask.md "Providers"), and the
// one call everything that uses a model makes: Ask, the conflict check and Describe to Set Up hand `callModel` a
// provider-neutral request, and the provider's own client writes and reads its API's shapes; built-in AI
// ("Built-in AI", built-in-client.ts) is the third, answered through the `AI` binding with no key. The key and `fetch`
// are parameters: nothing here reads an environment, logs, or puts a key in an error.
import { callClaude } from './claude-client';
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, claudeModel } from './claude-models';
import { claudeRequest } from './claude-request';
import { callBuiltIn, type BuiltInAiBinding } from './built-in-client';
import type { KeyProviderId } from './model-failure';
import type { ModelRequest } from './model-request';
import { callOpenAi } from './openai-client';
import { DEFAULT_OPENAI_MODEL, OPENAI_MODELS, openAiModel } from './openai-models';
import { openAiRequest } from './openai-request';

export type ProviderModel = { id: string; name: string };

export type ModelProvider = {
  id: KeyProviderId;
  /** As AI Settings lists it. */
  name: string;
  /** As a sentence names it ("OpenAI Did Not Accept the Key"). */
  spoken: string;
  /** The one host its API is called on, over HTTPS (the api's model door allows these and no other). */
  host: string;
  /** How its keys begin: the key field's placeholder. */
  keyPrefix: string;
  models: readonly ProviderModel[];
  defaultModel: string;
};

export const MODEL_PROVIDERS: readonly ModelProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    spoken: 'Claude',
    host: 'api.anthropic.com',
    keyPrefix: 'sk-ant-',
    models: CLAUDE_MODELS.map(({ id, name }) => ({ id, name })),
    defaultModel: DEFAULT_CLAUDE_MODEL,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    spoken: 'OpenAI',
    host: 'api.openai.com',
    keyPrefix: 'sk-',
    models: OPENAI_MODELS,
    defaultModel: DEFAULT_OPENAI_MODEL,
  },
];

export const DEFAULT_MODEL_PROVIDER: KeyProviderId = 'anthropic';

/** Whether `value` names a provider a key can be saved for (built-in AI is never one). */
export const isModelProviderId = (value: unknown): value is KeyProviderId =>
  MODEL_PROVIDERS.some((p) => p.id === value);

/** The provider a stored setting names. Nothing stored (a key kept before there was a choice) is Anthropic. */
export function modelProvider(id: unknown): ModelProvider {
  return MODEL_PROVIDERS.find((p) => p.id === id) ?? MODEL_PROVIDERS[0]!;
}

/** Whether `model` is one of the provider's own. */
export const isProviderModel = (provider: KeyProviderId, model: unknown): boolean =>
  modelProvider(provider).models.some((m) => m.id === model);

/** The provider's model a stored setting names, or its default (a model of the other provider, or none). */
export function providerModel(provider: KeyProviderId, model: unknown): ProviderModel {
  const { id, name } = provider === 'openai' ? openAiModel(model) : claudeModel(model);
  return { id, name };
}

export type ModelReply = {
  text: string;
  /** `end_turn`, or `max_tokens` when the answer was cut off. */
  stopReason: string;
  /** The model that answered. */
  model: string;
};

/** Which AI a call goes to: built-in AI through the binding, or a provider on the team's key. */
export type ModelCaller =
  | { provider: 'built-in'; ai: BuiltInAiBinding }
  | {
      provider: KeyProviderId;
      fetch: typeof fetch;
      apiKey: string;
      /** A stored setting: an id that is not the provider's reads as its default. */
      model: unknown;
    };

/** One streamed model call, on built-in AI or the team's own key. Throws a ModelCallError (model-failure.ts) for
 *  every failure, whichever provider: its `kind` is what a person is told, and its message never holds a key. */
export function callModel(
  options: ModelCaller & {
    request: ModelRequest;
    onText?: (text: string) => void;
    signal?: AbortSignal;
  },
): Promise<ModelReply> {
  const { request, onText, signal } = options;
  const streamed = { ...(onText ? { onText } : {}), ...(signal ? { signal } : {}) };
  if (options.provider === 'built-in') return callBuiltIn({ ai: options.ai, request, ...streamed });
  const call = { fetch: options.fetch, apiKey: options.apiKey, ...streamed };
  return options.provider === 'openai'
    ? callOpenAi({ ...call, request: openAiRequest(options.model, request) })
    : callClaude({ ...call, request: claudeRequest({ model: options.model, ...request }) });
}
