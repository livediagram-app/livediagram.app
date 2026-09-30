import type { Env } from './types';

// WHOSE model is this, and where does it live (docs/specs/007-editor/ai-assistance.md)?
//
// The answer is the KEY. A key belongs to one provider — a Google AI Studio key
// is useless to OpenAI — so the variable that holds it should say whose it is,
// and the base URL follows from that rather than being configured beside it.
// A variable called `OPENAI_API_KEY` holding a Gemini key is a lie every future
// reader has to decode.
//
// Three presets, and two FEATURES that each resolve their own provider from
// whichever keys are set ("Each feature has its own provider"): one key serves
// both, two named keys split them.

export type AiProviderName = 'google' | 'openai' | 'generic';

// The assistant is Ask / Clean (`/api/ai`); the reader reads the handwriting on
// event-storming sticky crops (`/api/ai/read-notes`).
export type AiFeature = 'assistant' | 'reader';

export type ResolvedAiProvider = {
  provider: AiProviderName;
  // Already normalised: no trailing slash.
  baseUrl: string;
  apiKey: string;
  // The model this feature uses on this provider.
  model: string;
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

// Each feature takes the FIRST present key in its own order. The assistant
// prefers OpenAI, the model it has always run on; the crop reader prefers
// Google, whose small model reads handwriting better for less. One key serves
// both, and the generic key comes last for both, so every feature is either
// available on every deployment that has a usable key or on none: one
// `aiEnabled` answers for both.
const PREFERENCE: Record<AiFeature, AiProviderName[]> = {
  assistant: ['openai', 'google', 'generic'],
  reader: ['google', 'openai', 'generic'],
};

const presetFor = (name: AiProviderName): Preset => PRESETS.find((p) => p.provider === name)!;

function hasKey(env: Env, preset: Preset): boolean {
  const value = env[preset.keyVar];
  return typeof value === 'string' && value.length > 0;
}

function firstPresent(env: Env, feature: AiFeature): Preset | null {
  for (const name of PREFERENCE[feature]) {
    const preset = presetFor(name);
    if (hasKey(env, preset)) return preset;
  }
  return null;
}

export function resolveAiProvider(env: Env, feature: AiFeature): ResolvedAiProvider | null {
  const preset = firstPresent(env, feature);
  if (!preset) return null;

  if (preset.provider !== 'generic' && hasKey(env, presetFor('generic'))) {
    // Outranked for EVERY feature, so the secret is spending nothing and
    // configuring nothing. Loud, because a dead secret is how an operator ends
    // up believing a deployment runs on something it does not.
    console.error(
      `[ai] AI_API_KEY is set but unused: ${String(preset.keyVar)} outranks it — remove one`,
    );
  }

  const apiKey = env[preset.keyVar] as string;
  const baseUrl = preset.baseUrl ?? (env.AI_BASE_URL ? trimTrailingSlashes(env.AI_BASE_URL) : '');

  if (preset.provider === 'generic' && (!baseUrl || !env.AI_MODEL)) {
    // A key with nowhere to send it, or somewhere to send it with nothing to
    // ask for, is not a configuration — it is half of one.
    console.error(
      '[ai] AI_API_KEY needs both AI_BASE_URL and AI_MODEL; use GOOGLE_AI_STUDIO_API_KEY or OPENAI_API_KEY for a known provider',
    );
    return null;
  }

  return {
    provider: preset.provider,
    baseUrl,
    apiKey,
    model: modelFor(env, feature, preset),
    strictSchema: preset.strictSchema,
  };
}

// `AI_MODEL` names a model of the provider serving the ASSISTANT, so it reaches
// the reader only when both run on that provider: a `gpt-4o` id sent to Gemini
// is a guaranteed failure. On one provider, an operator who NAMED a model means
// it for everything, so the preset's reader default applies only when nothing
// is named. `AI_VISION_MODEL` beats all of it, for the reader only.
function modelFor(env: Env, feature: AiFeature, preset: Preset): string {
  const fallback = preset.defaultModel ?? '';
  if (feature === 'assistant') return env.AI_MODEL ?? fallback;
  if (env.AI_VISION_MODEL) return env.AI_VISION_MODEL;
  const sharesAssistant = firstPresent(env, 'assistant')?.provider === preset.provider;
  if (sharesAssistant && env.AI_MODEL) return env.AI_MODEL;
  return preset.defaultVisionModel ?? fallback;
}

// Is there any AI on this deployment? Both features resolve from the same keys
// and fall back to each other's provider, so they are available together or
// not at all; asking the assistant answers for both.
export function aiConfigured(env: Env): boolean {
  return resolveAiProvider(env, 'assistant') !== null;
}
