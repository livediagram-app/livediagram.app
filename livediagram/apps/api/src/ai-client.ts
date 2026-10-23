import { resolveAiProvider, trimTrailingSlashes, type ResolvedAiProvider } from './ai-provider';
import type { Env } from './types';

// The one place the worker talks to a model (docs/specs/021-event-storming/note-reader.md).
//
// It does not know which company is on the other end. Every provider worth
// using speaks the OpenAI chat-completions wire — Google Gemini through its
// compatible endpoint, Mistral, OpenRouter, and a llama.cpp or
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

// The longest one provider call may wait for its answer to START (the response headers) before it is
// abandoned. A hosted model starts answering a text or a photo prompt in seconds; a provider that hangs
// (an overloaded endpoint, a self-hosted server gone quiet) used to hold the request open until the
// platform cut it, with the author watching a spinner. Only the wait for the headers is bounded: a
// streamed answer that has started may run as long as it runs. Generous on purpose: a large vision
// prompt on a slow self-hosted model is still a real answer. A timeout is not retried (a second wait
// as long helps nobody). Safe range: 30 s to 5 min.
export const AI_PROVIDER_TIMEOUT_MS = 120_000;

const isTimeout = (err: unknown) =>
  err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');

export async function chatCompletions(
  provider: ResolvedAiProvider,
  body: unknown,
): Promise<Response> {
  const send = async () => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new DOMException('provider did not answer', 'TimeoutError')),
      AI_PROVIDER_TIMEOUT_MS,
    );
    try {
      return await fetch(chatCompletionsUrl(provider.baseUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      // The headers are in (or the call failed): a stream that has started is never cut.
      clearTimeout(timer);
    }
  };
  let first: Response;
  try {
    first = await send();
  } catch (err) {
    if (isTimeout(err)) {
      console.error(`[ai] provider call timed out after ${AI_PROVIDER_TIMEOUT_MS} ms`);
      throw err;
    }
    // A network drop is worth the same one retry as a 5xx: the reason is logged,
    // and a spike that lasts two seconds should not cost the author their photo.
    console.error(
      '[ai] provider call failed; retrying once:',
      err instanceof Error ? err.message : String(err),
    );
    await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
    return send();
  }
  if (first.status < 500) return first;
  console.error(`[ai] provider responded ${first.status}; retrying once`);
  await new Promise((resolve) => setTimeout(resolve, RETRY_AFTER_MS));
  return send();
}

// Convenience for the routes: they have an Env, and they want its provider or
// nothing. The gate has already refused the "nothing" case by the time a route
// asks, so this never returns null in practice — but it is typed honestly.
export function providerOf(env: Env): ResolvedAiProvider | null {
  return resolveAiProvider(env);
}
