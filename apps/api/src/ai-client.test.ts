import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assistantModel,
  chatCompletions,
  chatCompletionsUrl,
  DEFAULT_AI_BASE_URL,
  visionModel,
} from './ai-client';
import type { Env } from './types';

// The one place the worker talks to a model (spec/25). Which provider that is
// must be a base URL, not a code path — so what is pinned here is the joining,
// the header, and that the body goes through untouched.

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('chatCompletionsUrl', () => {
  it('defaults to OpenAI, which is where an unconfigured self-host expects to go', () => {
    expect(chatCompletionsUrl(undefined)).toBe(`${DEFAULT_AI_BASE_URL}/chat/completions`);
  });

  it('joins a configured base', () => {
    expect(chatCompletionsUrl('https://generativelanguage.googleapis.com/v1beta/openai')).toBe(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    );
  });

  it('tolerates the trailing slash somebody pasted out of a provider’s docs', () => {
    expect(chatCompletionsUrl('http://127.0.0.1:8080/v1/')).toBe(
      'http://127.0.0.1:8080/v1/chat/completions',
    );
    expect(chatCompletionsUrl('http://127.0.0.1:8080/v1///')).toBe(
      'http://127.0.0.1:8080/v1/chat/completions',
    );
  });
});

describe('the model ids', () => {
  it('defaults the assistant, and points the reader at it unless told otherwise', () => {
    expect(assistantModel({} as Env)).toBe('gpt-4o');
    expect(visionModel({} as Env)).toBe('gpt-4o');
    expect(visionModel({ AI_MODEL: 'gemini-flash' } as Env)).toBe('gemini-flash');
    expect(visionModel({ AI_MODEL: 'a', AI_VISION_MODEL: 'b' } as Env)).toBe('b');
  });
});

describe('chatCompletions', () => {
  it('posts the body as-is, with the key as a bearer token', async () => {
    const spy = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    const env = { AI_API_KEY: 'secret-key', AI_BASE_URL: 'https://example.test/v1' } as Env;
    await chatCompletions(env, { model: 'm', messages: [] });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'm', messages: [] });
  });

  it('hands the provider’s response back untouched, failures included', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 429 })) as typeof fetch;
    const res = await chatCompletions({ AI_API_KEY: 'k' } as Env, {});
    expect(res.status).toBe(429);
  });
});
