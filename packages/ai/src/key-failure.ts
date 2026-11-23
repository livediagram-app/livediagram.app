// A key's failure as every app says it (liveworkspace/docs/specs/003-accounts/ai-keys.md "The source line"): whose key
// failed and how, never any part of the key. Its own entry, so a page reads a refusal without loading a model client.
import type { KeyProviderId, ModelFailureKind } from './model-failure';
import { modelFailureWords } from './model-failure';

/** Whose key applies: the item's own (a liveknowledge knowledgebase's), the item's team's, or the person's own. */
export type AiKeySource = 'item' | 'team' | 'account';

/** The failures of a key a person fixes in Settings, and one that will not open. */
export type AiKeyFailureKind =
  Extract<ModelFailureKind, 'bad-key' | 'no-credit' | 'model-unavailable'> | 'unreadable';

/** A key's failure as a refusal carries it (`aiKey` beside `error: 'ai_key_failed'`): never any part of the key. */
export type AiKeyFailure = {
  source: AiKeySource;
  provider: KeyProviderId | null;
  kind: AiKeyFailureKind;
};

/** The refusal's error code, in every app. */
export const AI_KEY_FAILED = 'ai_key_failed';

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
  kind === 'bad-key' ||
  kind === 'no-credit' ||
  kind === 'model-unavailable' ||
  kind === 'unreadable';

/** Reads `aiKey` from a refusal's body: null for anything else. */
export function readAiKeyFailure(body: unknown): AiKeyFailure | null {
  if (!body || typeof body !== 'object') return null;
  const raw =
    (body as { error?: unknown; aiKey?: unknown }).error === AI_KEY_FAILED
      ? (body as { aiKey?: unknown }).aiKey
      : undefined;
  if (!raw || typeof raw !== 'object') return null;
  const { source, provider, kind } = raw as Record<string, unknown>;
  if (source !== 'item' && source !== 'team' && source !== 'account') return null;
  if (provider !== null && provider !== 'anthropic' && provider !== 'openai') return null;
  if (!isKeyFailureKind(kind)) return null;
  return { source, provider, kind };
}
