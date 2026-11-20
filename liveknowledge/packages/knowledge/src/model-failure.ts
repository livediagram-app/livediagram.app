// A failed model call, whichever provider answered (docs/specs/030-knowledgebase/search-and-ask.md "Providers"):
// one of a few kinds a person can be told in words. The error's message is the kind's fixed words for the provider;
// it holds no key, no request and nothing the provider's API said.

/** Whose API a knowledgebase's key is for. */
export type ModelProviderId = 'anthropic' | 'openai';

export type ModelFailureKind =
  | 'bad-key'
  | 'no-credit'
  | 'rate-limited'
  | 'overloaded'
  | 'model-unavailable'
  | 'refused'
  | 'other';

// What each provider is called inside a sentence.
const SPOKEN: Readonly<Record<ModelProviderId, string>> = { anthropic: 'Claude', openai: 'OpenAI' };

/** What a person is told for a kind of failure, naming the provider where it matters. */
export function modelFailureWords(provider: ModelProviderId, kind: ModelFailureKind): string {
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
