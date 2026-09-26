import type { Env } from './types';

// WHOSE model is this, and where does it live (docs/specs/007-editor/ai-assistance.md)?
//
// The answer is the KEY. A key belongs to one provider — a Google AI Studio key
// is useless to OpenAI — so the variable that holds it should say whose it is,
// and the base URL follows from that rather than being configured beside it.
// A variable called `OPENAI_API_KEY` holding a Gemini key is a lie every future
// reader has to decode.
//
// Three presets. Exactly one may be set: two keys is an operator mistake with a
// bill attached, so it resolves to nothing and says so loudly rather than
// guessing whose budget to spend.

export type AiProviderName = 'google' | 'openai' | 'generic';

export type ResolvedAiProvider = {
  provider: AiProviderName;
  // Already normalised: no trailing slash.
  baseUrl: string;
  apiKey: string;
  // The model the assistant uses.
  model: string;
  // The model the crop reader uses; defaults to `model`.
  visionModel: string;
  // Whether the endpoint honours `response_format: json_schema` with
  // `strict: true`. Known for the google and openai presets; unknown for a
  // generic endpoint, which keeps JSON mode.
  strictSchema: boolean;
};

// Google's OpenAI-compatible surface. Fixed: it is a property of the provider,
// not something an operator should have to look up.
export const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Discovered from the key's own `/models` listing rather than guessed, and
// then actually called: newer ids exist (3.7, 3.8) but were answering 503
// "high demand" when checked, and `gemini-flash-latest` is an alias that would
// move under a deployment without anyone changing anything. 3.6 answered
// every time, in JSON mode. See docs/specs/007-editor/ai-assistance.md for the date. `AI_MODEL` overrides it.
export const GOOGLE_DEFAULT_MODEL = 'gemini-3.6-flash';
export const OPENAI_DEFAULT_MODEL = 'gpt-4o';

// Reading the handwriting off a sticky is not the assistant's job, and it does
// not want the assistant's model. Measured on a real workshop wall through this
// worker's own request shape, the small cheap model read 99% of the words at
// 0.2% character error against 95% / 1.1% for the big one — while costing about
// a quarter as much per token and finishing the wall four times faster.
//
// That is not a paradox: reading a scrawl verbatim is literal work, and the
// reasoning a larger model brings is spent on a task with nothing to reason
// about (it also has to be paid for out of `max_tokens`). See
// docs/research/vision/handwriting-readers.md for the run.
export const GOOGLE_DEFAULT_VISION_MODEL = 'gemini-2.5-flash-lite';

type Preset = {
  provider: AiProviderName;
  keyVar: keyof Env;
  baseUrl?: string;
  defaultModel?: string;
  // What the crop READER uses when the operator has not named a model at all.
  defaultVisionModel?: string;
  strictSchema: boolean;
};

const PRESETS: Preset[] = [
  {
    provider: 'google',
    keyVar: 'GOOGLE_AI_STUDIO_API_KEY',
    baseUrl: GOOGLE_BASE_URL,
    defaultModel: GOOGLE_DEFAULT_MODEL,
    defaultVisionModel: GOOGLE_DEFAULT_VISION_MODEL,
    strictSchema: true,
  },
  {
    provider: 'openai',
    keyVar: 'OPENAI_API_KEY',
    baseUrl: OPENAI_BASE_URL,
    defaultModel: OPENAI_DEFAULT_MODEL,
    strictSchema: true,
  },
  // Anything else that speaks the same wire: Mistral, OpenRouter, a local
  // llama.cpp or Ollama. No default model, because there is no knowing what is
  // loaded on the other end.
  { provider: 'generic', keyVar: 'AI_API_KEY', strictSchema: false },
];

// Trailing slashes off a base URL, WITHOUT a regex.
//
// `/\/+$/` looks harmless and is not: on a string of slashes the engine
// backtracks polynomially, and a base URL is operator-supplied configuration
// that reaches this on every AI request (CodeQL js/polynomial-redos). A loop
// says the same thing in linear time and cannot be made to misbehave.
export function trimTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end -= 1;
  return url.slice(0, end);
}

export function resolveAiProvider(env: Env): ResolvedAiProvider | null {
  const present = PRESETS.filter((p) => {
    const value = env[p.keyVar];
    return typeof value === 'string' && value.length > 0;
  });

  if (present.length === 0) return null;
  if (present.length > 1) {
    // Fail CLOSED and loud: picking one would be spending somebody's money on
    // a coin flip, and silently picking one is how that goes unnoticed.
    console.error(
      `[ai] refusing to guess a provider: ${present.map((p) => String(p.keyVar)).join(' and ')} are both set — keep exactly one`,
    );
    return null;
  }

  const preset = present[0]!;
  const apiKey = env[preset.keyVar] as string;
  const baseUrl = preset.baseUrl ?? (env.AI_BASE_URL ? trimTrailingSlashes(env.AI_BASE_URL) : '');
  const model = env.AI_MODEL ?? preset.defaultModel ?? '';

  if (preset.provider === 'generic') {
    // A key with nowhere to send it, or somewhere to send it with nothing to
    // ask for, is not a configuration — it is half of one.
    if (!baseUrl || !model) {
      console.error(
        '[ai] AI_API_KEY needs both AI_BASE_URL and AI_MODEL; use GOOGLE_AI_STUDIO_API_KEY or OPENAI_API_KEY for a known provider',
      );
      return null;
    }
  }

  return {
    provider: preset.provider,
    baseUrl,
    apiKey,
    model,
    // An operator who NAMED a model means it for everything, so the preset's
    // reader default only applies when they have named nothing: overriding a
    // deliberate choice with our own would be the surprising half of a helpful
    // default. `AI_VISION_MODEL` beats both.
    visionModel:
      env.AI_VISION_MODEL ?? (env.AI_MODEL ? model : (preset.defaultVisionModel ?? model)),
    strictSchema: preset.strictSchema,
  };
}
