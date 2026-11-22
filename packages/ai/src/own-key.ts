// Which AI a person's model call runs on, in every app (liveworkspace/docs/specs/003-accounts/ai-keys.md "Every AI
// feature honours the choice"): the accounts answer (`aiKeyFor`, `want: 'key'`) read into a caller on the key, built-in
// AI, or a refusal said in fixed words. Pure: the answer and `fetch` are handed in, and the key only ever reaches
// the caller it builds, whose `fetch` refuses every host but the provider's own.
import type { KeyProviderId, ModelFailureKind } from './model-failure';
import { modelFailureWords } from './model-failure';
import { providerModel } from './model-providers';
import { providerFetch } from './provider-door';

/** Whose key applies: the item's own (a liveknowledge knowledgebase's), the item's team's, or the person's own. */
export type AiKeySource = 'item' | 'team' | 'account';

/** What accounts answered, as `@liveworkspace/auth-client`'s `aiKeyFor` gives it. */
export type KeyAnswer =
  | { status: 'key'; source: AiKeySource; provider: KeyProviderId; model: string; key?: string }
  | { status: 'none' }
  | { status: 'unreadable'; source: AiKeySource }
  | { status: 'unavailable' };

/** The failures of a key a person fixes in Settings, and one that will not open. */
export type AiKeyFailureKind = Extract<
  ModelFailureKind,
  'bad-key' | 'no-credit' | 'model-unavailable'
> | 'unreadable';

/** A key's failure as a refusal carries it (`aiKey` beside `error: 'ai_key_failed'`): never any part of the key. */
export type AiKeyFailure = { source: AiKeySource; provider: KeyProviderId | null; kind: AiKeyFailureKind };

/** The refusal's error code, in every app. */
export const AI_KEY_FAILED = 'ai_key_failed';

/** The call on a key: the provider's client with the key, through the provider's own address. */
export type KeyCaller = { provider: KeyProviderId; fetch: typeof fetch; apiKey: string; model: string };

export type OwnKey =
  | { status: 'key'; source: AiKeySource; provider: KeyProviderId; model: string; caller: KeyCaller }
  | { status: 'built-in' }
  | { status: 'refused'; reason: 'unreadable'; failure: AiKeyFailure; words: string }
  | { status: 'refused'; reason: 'unavailable'; words: string };

/** Accounts could not say whose key applies: the person's words never go to built-in AI on a guess. */
export const AI_KEY_UNREACHABLE_WORDS =
  "Your AI key settings couldn't be reached just now. Try again in a moment.";

const UNREADABLE_WORDS: Readonly<Record<AiKeySource, string>> = {
  item: 'Its own stored AI key could not be read. An Editor can replace it in its AI Settings.',
  team: "Your team's AI key could not be read. An admin can replace it in Settings, under AI.",
  account: 'Your AI key could not be read. Replace it in Settings, under AI.',
};

/** What a person is told for a key's failure: the provider's kind in fixed words, or that it would not open. */
export function aiKeyFailureWords(failure: AiKeyFailure): string {
  if (failure.kind === 'unreadable' || failure.provider === null)
    return UNREADABLE_WORDS[failure.source];
  return modelFailureWords(failure.provider, failure.kind);
}

/** Whether a failure on a key is one the person fixes in Settings (the line says so), not a passing one. */
export const isKeyFailureKind = (kind: unknown): kind is AiKeyFailureKind =>
  kind === 'bad-key' || kind === 'no-credit' || kind === 'model-unavailable' || kind === 'unreadable';

/** Reads `aiKey` from a refusal's body: null for anything else. */
export function readAiKeyFailure(body: unknown): AiKeyFailure | null {
  if (!body || typeof body !== 'object') return null;
  const raw = (body as { error?: unknown; aiKey?: unknown }).error === AI_KEY_FAILED
    ? (body as { aiKey?: unknown }).aiKey
    : undefined;
  if (!raw || typeof raw !== 'object') return null;
  const { source, provider, kind } = raw as Record<string, unknown>;
  if (source !== 'item' && source !== 'team' && source !== 'account') return null;
  if (provider !== null && provider !== 'anthropic' && provider !== 'openai') return null;
  if (!isKeyFailureKind(kind)) return null;
  return { source, provider, kind };
}

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
  if (!answer.key) return { status: 'refused', reason: 'unavailable', words: AI_KEY_UNREACHABLE_WORDS };
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
