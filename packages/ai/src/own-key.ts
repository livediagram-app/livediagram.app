// Which AI a person's model call runs on, in every app (liveworkspace/docs/specs/003-accounts/ai-keys.md "Every AI
// feature honours the choice"): the accounts answer (`aiKeyFor`, `want: 'key'`) read into a caller on the key, built-in
// AI, or a refusal said in fixed words. Pure: the answer and `fetch` are handed in, and the key only ever reaches
// the caller it builds, whose `fetch` refuses every host but the provider's own.
import type { KeyProviderId } from './model-failure';
import {
  AI_KEY_FAILED,
  aiKeyFailureWords,
  isKeyFailureKind,
  readAiKeyFailure,
  type AiKeyFailure,
  type AiKeyFailureKind,
  type AiKeySource,
} from './key-failure';
import { providerModel } from './model-providers';
import { providerFetch } from './provider-door';

export {
  AI_KEY_FAILED,
  aiKeyFailureWords,
  isKeyFailureKind,
  readAiKeyFailure,
  type AiKeyFailure,
  type AiKeyFailureKind,
  type AiKeySource,
};

/** What accounts answered, as `@liveworkspace/auth-client`'s `aiKeyFor` gives it. */
export type KeyAnswer =
  | { status: 'key'; source: AiKeySource; provider: KeyProviderId; model: string; key?: string }
  | { status: 'none' }
  | { status: 'unreadable'; source: AiKeySource }
  | { status: 'unavailable' };

/** The call on a key: the provider's client with the key, through the provider's own address. */
export type KeyCaller = {
  provider: KeyProviderId;
  fetch: typeof fetch;
  apiKey: string;
  model: string;
};

export type OwnKey =
  | {
      status: 'key';
      source: AiKeySource;
      provider: KeyProviderId;
      model: string;
      caller: KeyCaller;
    }
  | { status: 'built-in' }
  | { status: 'refused'; reason: 'unreadable'; failure: AiKeyFailure; words: string }
  | { status: 'refused'; reason: 'unavailable'; words: string };

/** Accounts could not say whose key applies: the person's words never go to built-in AI on a guess. */
export const AI_KEY_UNREACHABLE_WORDS =
  "Your AI key settings couldn't be reached just now. Try again in a moment.";

/** The call a person's request runs on. `answer` null: no person to ask for (an API token, a guest, a server with no
 *  accounts), so built-in AI. A key that will not open, or accounts that could not answer, is refused in words. */
export function ownKeyOf(answer: KeyAnswer | null, through: typeof fetch = fetch): OwnKey {
  if (!answer || answer.status === 'none') return { status: 'built-in' };
  if (answer.status === 'unavailable')
    return { status: 'refused', reason: 'unavailable', words: AI_KEY_UNREACHABLE_WORDS };
  if (answer.status === 'unreadable') {
    const failure: AiKeyFailure = { source: answer.source, provider: null, kind: 'unreadable' };
    return { status: 'refused', reason: 'unreadable', failure, words: aiKeyFailureWords(failure) };
  }
  if (!answer.key)
    return { status: 'refused', reason: 'unavailable', words: AI_KEY_UNREACHABLE_WORDS };
  const model = providerModel(answer.provider, answer.model).id;
  return {
    status: 'key',
    source: answer.source,
    provider: answer.provider,
    model,
    caller: {
      provider: answer.provider,
      fetch: providerFetch(answer.provider, through),
      apiKey: answer.key,
      model,
    },
  };
}
