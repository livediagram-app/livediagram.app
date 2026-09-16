import { resolveAiProvider, type ResolvedAiProvider } from './ai-provider';
import type { Env } from './types';

// The one place the worker talks to a model (spec/25).
//
// It does not know which company is on the other end. Every provider worth
// using speaks the OpenAI chat-completions wire — Google Gemini through its
// compatible endpoint, OpenAI itself, Mistral, OpenRouter, and a llama.cpp or
// Ollama server on somebody's laptop — so "which provider" is a key and a base
// URL (see ai-provider.ts), not a code path.

export function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

export async function chatCompletions(
  provider: ResolvedAiProvider,
  body: unknown,
): Promise<Response> {
  return fetch(chatCompletionsUrl(provider.baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// Convenience for the routes: they have an Env, and they want the provider or
// nothing. The gate has already refused the "nothing" case by the time a route
// asks, so this never returns null in practice — but it is typed honestly.
export function providerOf(env: Env): ResolvedAiProvider | null {
  return resolveAiProvider(env);
}
