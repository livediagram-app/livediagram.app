import type { Env } from './types';

// WHOSE model reads the sticky-note crops, and where does it live
// (docs/specs/021-event-storming/note-reader.md)?
//
// The answer is the KEY. A key belongs to one provider — a Google AI Studio key
// is useless anywhere else — so the variable that holds it should say whose it
// is, and the base URL follows from that rather than being configured beside it.
//
// The note reader (`/api/ai/read-notes`) is the only model call this worker
// makes. Two presets serve it: Google by its own key, or any other endpoint
// that speaks the same wire by a generic key, base URL and model.

export type AiProviderName = 'google' | 'generic';

export type ResolvedAiProvider = {
  provider: AiProviderName;
  // Already normalised: no trailing slash.
  baseUrl: string;
  apiKey: string;
  // The model the reader uses on this provider.
  model: string;
  // Whether the endpoint honours `response_format: json_schema` with
  // `strict: true`. Known for the google preset; unknown for a generic
  // endpoint, which keeps JSON mode.
  strictSchema: boolean;
};

// Google's OpenAI-compatible surface. Fixed: it is a property of the provider,
// not something an operator should have to look up.
export const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';

// Reading a scrawl verbatim is literal work. Measured on a real workshop wall
// through this worker's own request shape, the small cheap model read 99% of
// the words at 0.2% character error against 95% / 1.1% for a bigger one, while
// costing about a quarter as much per token and finishing the wall four times
// faster. See docs/research/vision/handwriting-readers.md for the run.
// `AI_VISION_MODEL` overrides it.
export const GOOGLE_DEFAULT_VISION_MODEL = 'gemini-2.5-flash-lite';

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

const present = (value: string | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

// Google first, whose small model reads handwriting better for less; the
// generic key (Mistral, OpenRouter, a local llama.cpp or Ollama) after it.
export function resolveAiProvider(env: Env): ResolvedAiProvider | null {
  if (present(env.GOOGLE_AI_STUDIO_API_KEY)) {
    if (present(env.AI_API_KEY)) {
      // Outranked, so the secret is spending nothing and configuring nothing.
      // Loud, because a dead secret is how an operator ends up believing a
      // deployment runs on something it does not.
      console.error(
        '[ai] AI_API_KEY is set but unused: GOOGLE_AI_STUDIO_API_KEY outranks it — remove one',
      );
    }
    return {
      provider: 'google',
      baseUrl: GOOGLE_BASE_URL,
      apiKey: env.GOOGLE_AI_STUDIO_API_KEY,
      model: env.AI_VISION_MODEL || GOOGLE_DEFAULT_VISION_MODEL,
      strictSchema: true,
    };
  }

  if (!present(env.AI_API_KEY)) return null;
  const baseUrl = env.AI_BASE_URL ? trimTrailingSlashes(env.AI_BASE_URL) : '';
  if (!baseUrl || !present(env.AI_VISION_MODEL)) {
    // A key with nowhere to send it, or somewhere to send it with nothing to
    // ask for, is not a configuration — it is half of one. There is no default
    // model, because there is no knowing what is loaded on the other end.
    console.error(
      '[ai] AI_API_KEY needs both AI_BASE_URL and AI_VISION_MODEL; use GOOGLE_AI_STUDIO_API_KEY for Google',
    );
    return null;
  }
  return {
    provider: 'generic',
    baseUrl,
    apiKey: env.AI_API_KEY,
    model: env.AI_VISION_MODEL,
    strictSchema: false,
  };
}

// Can this deployment read sticky notes from a photo?
export function aiConfigured(env: Env): boolean {
  return resolveAiProvider(env) !== null;
}
