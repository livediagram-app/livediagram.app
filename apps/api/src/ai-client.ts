import type { Env } from './types';

// The one place the worker talks to a model (spec/25).
//
// It does not know which company is on the other end. Every provider worth
// using speaks the OpenAI chat-completions wire — OpenAI itself, Google Gemini
// through its compatible endpoint, Mistral, OpenRouter, and a llama.cpp or
// Ollama server on somebody's laptop — so "which provider" is a BASE URL and a
// key, not a code path.
//
// That is also why the env is `AI_*` and not `OPENAI_*`: a variable called
// `OPENAI_API_KEY` holding a Gemini key is a lie every future reader has to
// decode.

export const DEFAULT_AI_BASE_URL = 'https://api.openai.com/v1';
export const DEFAULT_AI_MODEL = 'gpt-4o';

// Join the configured base with the path, tolerating a trailing slash: an
// operator pasting a URL out of a provider's docs should not have to know
// which convention we picked.
export function chatCompletionsUrl(baseUrl: string | undefined): string {
  const base = (baseUrl ?? DEFAULT_AI_BASE_URL).replace(/\/+$/, '');
  return `${base}/chat/completions`;
}

export function assistantModel(env: Env): string {
  return env.AI_MODEL ?? DEFAULT_AI_MODEL;
}

// The vision model defaults to the ordinary one, so a deployment only sets it
// when it wants the two to differ.
export function visionModel(env: Env): string {
  return env.AI_VISION_MODEL ?? env.AI_MODEL ?? DEFAULT_AI_MODEL;
}

export async function chatCompletions(env: Env, body: unknown): Promise<Response> {
  return fetch(chatCompletionsUrl(env.AI_BASE_URL), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
