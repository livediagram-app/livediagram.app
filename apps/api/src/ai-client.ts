import { resolveAiProvider, trimTrailingSlashes, type ResolvedAiProvider } from './ai-provider';
import type { Env } from './types';

// The one place the worker talks to a model (spec/25).
//
// It does not know which company is on the other end. Every provider worth
// using speaks the OpenAI chat-completions wire — Google Gemini through its
// compatible endpoint, OpenAI itself, Mistral, OpenRouter, and a llama.cpp or
// Ollama server on somebody's laptop — so "which provider" is a key and a base
// URL (see ai-provider.ts), not a code path.

export function chatCompletionsUrl(baseUrl: string): string {
  return `${trimTrailingSlashes(baseUrl)}/chat/completions`;
}

// One retry on a 5xx, after a breath.
//
// Not a general resilience layer: specifically, a hosted flash model answers
// 503 "this model is currently experiencing high demand" often enough that a
// single import run hits it, and a spike that lasts two seconds should not
// cost the author their photo. A 4xx is never retried — that is our mistake,
// and repeating it just spends the budget twice.
const RETRY_AFTER_MS = 1200;

export async function chatCompletions(
  provider: ResolvedAiProvider,
  body: unknown,
): Promise<Response> {
  const send = () =>
    fetch(chatCompletionsUrl(provider.baseUrl), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  const first = await send();
  if (first.status < 500) return first;
  console.error(`[ai] provider responded ${first.status}; retrying once`);
  await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
  return send();
}

// Convenience for the routes: they have an Env, and they want the provider or
// nothing. The gate has already refused the "nothing" case by the time a route
// asks, so this never returns null in practice — but it is typed honestly.
export function providerOf(env: Env): ResolvedAiProvider | null {
  return resolveAiProvider(env);
}
