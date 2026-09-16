import type { Env } from './types';

// WHOSE model is this, and where does it live (spec/25)?
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
};

// Google's OpenAI-compatible surface. Fixed: it is a property of the provider,
// not something an operator should have to look up.
export const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const OPENAI_BASE_URL = 'https://api.openai.com/v1';

// Discovered from the key's own `/models` listing rather than guessed, and
// then actually called: newer ids exist (3.7, 3.8) but were answering 503
// "high demand" when checked, and `gemini-flash-latest` is an alias that would
// move under a deployment without anyone changing anything. 3.6 answered
// every time, in JSON mode. See spec/25 for the date. `AI_MODEL` overrides it.
export const GOOGLE_DEFAULT_MODEL = 'gemini-3.6-flash';
export const OPENAI_DEFAULT_MODEL = 'gpt-4o';

type Preset = {
  provider: AiProviderName;
  keyVar: keyof Env;
  baseUrl?: string;
  defaultModel?: string;
};

const PRESETS: Preset[] = [
  {
    provider: 'google',
    keyVar: 'GOOGLE_AI_STUDIO_API_KEY',
    baseUrl: GOOGLE_BASE_URL,
    defaultModel: GOOGLE_DEFAULT_MODEL,
  },
  {
    provider: 'openai',
    keyVar: 'OPENAI_API_KEY',
    baseUrl: OPENAI_BASE_URL,
    defaultModel: OPENAI_DEFAULT_MODEL,
  },
  // Anything else that speaks the same wire: Mistral, OpenRouter, a local
  // llama.cpp or Ollama. No default model, because there is no knowing what is
  // loaded on the other end.
  { provider: 'generic', keyVar: 'AI_API_KEY' },
];

function trimSlashes(url: string): string {
  return url.replace(/\/+$/, '');
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
  const baseUrl = preset.baseUrl ?? (env.AI_BASE_URL ? trimSlashes(env.AI_BASE_URL) : '');
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
    visionModel: env.AI_VISION_MODEL ?? model,
  };
}
