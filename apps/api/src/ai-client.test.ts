import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatCompletions, chatCompletionsUrl, providerOf } from './ai-client';
import { GOOGLE_BASE_URL } from './ai-provider';
import type { Env } from './types';

// The one place the worker talks to a model (spec/25). Whose model that is
// comes from ai-provider.ts; what is pinned here is the joining, the header,
// and that the body goes through untouched.

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

const provider = {
  provider: 'google' as const,
  baseUrl: GOOGLE_BASE_URL,
  apiKey: 'secret-key',
  model: 'm',
  visionModel: 'm',
};

describe('chatCompletionsUrl', () => {
  it('joins the provider’s base', () => {
    expect(chatCompletionsUrl(GOOGLE_BASE_URL)).toBe(`${GOOGLE_BASE_URL}/chat/completions`);
  });

  it('tolerates a trailing slash', () => {
    expect(chatCompletionsUrl('http://127.0.0.1:8080/v1/')).toBe(
      'http://127.0.0.1:8080/v1/chat/completions',
    );
  });
});

describe('chatCompletions', () => {
  it('posts the body as-is, with the key as a bearer token', async () => {
    const spy = vi.fn(async () => new Response('{}', { status: 200 }));
    globalThis.fetch = spy as unknown as typeof fetch;
    await chatCompletions(provider, { model: 'm', messages: [] });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${GOOGLE_BASE_URL}/chat/completions`);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(JSON.parse(init.body as string)).toEqual({ model: 'm', messages: [] });
  });

  it('hands the provider’s response back untouched, failures included', async () => {
    globalThis.fetch = vi.fn(async () => new Response('nope', { status: 429 })) as typeof fetch;
    expect((await chatCompletions(provider, {})).status).toBe(429);
  });
});

describe('providerOf', () => {
  it('is the resolver, for a route that has only an Env', () => {
    expect(providerOf({ GOOGLE_AI_STUDIO_API_KEY: 'k' } as Env)?.provider).toBe('google');
    expect(providerOf({} as Env)).toBeNull();
  });
});

describe('one retry on a provider spike', () => {
  it('retries a 5xx once, and returns the second answer', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return calls === 1
        ? new Response('busy', { status: 503 })
        : new Response('{"ok":true}', { status: 200 });
    }) as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await chatCompletions(provider, {});
    expect(calls).toBe(2);
    expect(res.status).toBe(200);
  });

  it('gives up after the second 5xx rather than hammering', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return new Response('busy', { status: 503 });
    }) as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await chatCompletions(provider, {})).status).toBe(503);
    expect(calls).toBe(2);
  });

  it('never retries a 4xx — that is our mistake, not a spike', async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      return new Response('nope', { status: 400 });
    }) as typeof fetch;
    await chatCompletions(provider, {});
    expect(calls).toBe(1);
  });
});

describe('the base URL is trimmed without a regex', () => {
  it('drops any number of trailing slashes', () => {
    expect(chatCompletionsUrl('https://api.example.com')).toBe(
      'https://api.example.com/chat/completions',
    );
    expect(chatCompletionsUrl('https://api.example.com/v1///')).toBe(
      'https://api.example.com/v1/chat/completions',
    );
  });

  it('does not degrade on a pathological run of slashes', () => {
    // The regex this replaced backtracked polynomially here
    // (CodeQL js/polynomial-redos), and a base URL is operator configuration.
    const started = performance.now();
    expect(chatCompletionsUrl('https://x'.padEnd(50_000, '/'))).toBe('https://x/chat/completions');
    expect(performance.now() - started).toBeLessThan(50);
  });
});
