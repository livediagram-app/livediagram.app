// A failed model call, whichever provider answered (docs/specs/030-knowledgebase/search-and-ask.md "Providers"):
// one of a few kinds a person can be told in words. The error's message is the kind's fixed words for the provider;
// it holds no key, no request and nothing the provider's API said.

/** Whose API a knowledgebase's key is for. */
export type KeyProviderId = 'anthropic' | 'openai';
/** Which AI answers a call: built-in AI (Workers AI, liveknowledge's; search-and-ask.md "Built-in AI") with no key,
 *  else the provider the team's key is for. No key can be saved for `built-in`. */
export type ModelProviderId = KeyProviderId | 'built-in';

export type ModelFailureKind =
  | 'bad-key'
  | 'no-credit'
  | 'rate-limited'
  | 'overloaded'
  | 'model-unavailable'
  | 'refused'
  | 'other';

// What each provider is called inside a sentence.
const SPOKEN: Readonly<Record<KeyProviderId, string>> = { anthropic: 'Claude', openai: 'OpenAI' };

/** Built-in AI has no key, no credit and no model to choose: every failure is that it could not answer. */
export const BUILT_IN_FAILED_WORDS =
  "The built-in AI couldn't answer just now. Try again in a moment.";

/** What a person is told for a kind of failure, naming the provider where it matters. */
export function modelFailureWords(provider: ModelProviderId, kind: ModelFailureKind): string {
  if (provider === 'built-in') return BUILT_IN_FAILED_WORDS;
  const name = SPOKEN[provider];
  switch (kind) {
    case 'bad-key':
      return `${name} did not accept the API key. Replace it in Settings.`;
    case 'no-credit':
      return `The ${name} account for this key has no credit left.`;
    case 'rate-limited':
      return `The ${name} account for this key is at its rate limit. Try again in a minute.`;
    case 'overloaded':
      return `${name} is busy right now. Try again in a moment.`;
    case 'model-unavailable':
      return 'This key cannot use the chosen model. Choose another in Settings.';
    case 'refused':
      return `${name} declined to answer this.`;
    case 'other':
      return 'The answer could not be made. Try again.';
  }
}

/** A failed model call. Its message is the kind's words; it holds no key, no request and no API message. */
export class ModelCallError extends Error {
  readonly provider: ModelProviderId;
  readonly kind: ModelFailureKind;
  /** The HTTP status, when the API answered with one. */
  readonly status: number | undefined;

  constructor(provider: ModelProviderId, kind: ModelFailureKind, status?: number) {
    super(modelFailureWords(provider, kind));
    this.name = 'ModelCallError';
    this.provider = provider;
    this.kind = kind;
    this.status = status;
  }
}
