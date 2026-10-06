import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAi } from './ai';
import type { RouteContext } from './context';
import type { Env } from '../types';

// These tests pin the two spend-DoS gates on POST /api/ai (docs/specs/007-editor/ai-assistance.md):
//
//   1. AI_ALLOWED_ORIGINS: when set, the worker must reject any request
//      whose Origin header isn't in the comma-separated allow-list with
//      403 origin_not_allowed BEFORE reaching OpenAI.
//   2. AI_REQUIRE_CLERK: when "true", the worker must reject the
//      X-Owner-Id guest path with 401 sign_in_required.
//
// Both gates have safe defaults (unset = old open behaviour) so the OSS
// self-host story stays intact. Each test sets OPENAI_API_KEY to a
// non-empty stub so we never reach the ai_not_configured short-circuit
// at the top of handleAi; the gates we care about run between that
// check and the rate-limiter, and we assert they never proceed past
// their own response code.

// The "allow" branches in these tests would otherwise reach the real
// OpenAI endpoint with a stub key and the test environment would make a
// flaky outbound HTTPS call. We stub global fetch to return a benign
// 200 so handleAi resolves locally; the only thing the assertions care
// about is that the gate response code (403 / 401) is NOT returned.
const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"elements":[]}' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  ) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

function makeCtx(opts: {
  env: Partial<Env>;
  origin?: string | null;
  clerkUserId?: string | null;
  body?: string;
}): RouteContext {
  const headers = new Headers();
  if (opts.origin !== null && opts.origin !== undefined) {
    headers.set('Origin', opts.origin);
  }
  const request = new Request('https://api.example.com/api/ai', {
    method: 'POST',
    headers,
    body: opts.body ?? JSON.stringify({ mode: 'clean', prompt: 'p', elements: [], tabName: 't' }),
  });
  return {
    request,
    env: { OPENAI_API_KEY: 'test-key', ...opts.env } as Env,
    url: new URL(request.url),
    segments: ['api', 'ai'],
    clerkUserId: opts.clerkUserId ?? null,
    verifiedUserId: opts.clerkUserId ?? null,
    clerkEmail: null,
    resolveOwner: () => opts.clerkUserId ?? 'owner-anon',
  };
}

describe('handleAi origin allow-list (AI_ALLOWED_ORIGINS)', () => {
  it('accepts requests when AI_ALLOWED_ORIGINS is unset (default OSS behaviour)', async () => {
    const ctx = makeCtx({ env: {}, origin: 'https://random.example' });
    const res = await handleAi(ctx);
    expect(res.status).not.toBe(403);
  });

  it('rejects with 403 origin_not_allowed when Origin is missing', async () => {
    const ctx = makeCtx({
      env: { AI_ALLOWED_ORIGINS: 'https://livediagram.app' },
      origin: null,
    });
    const res = await handleAi(ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'origin_not_allowed' });
  });

  it('rejects with 403 origin_not_allowed when Origin is not in the list', async () => {
    const ctx = makeCtx({
      env: { AI_ALLOWED_ORIGINS: 'https://livediagram.app' },
      origin: 'https://evil.example',
    });
    const res = await handleAi(ctx);
    expect(res.status).toBe(403);
  });

  it('accepts when Origin matches one of multiple comma-separated entries (whitespace tolerant)', async () => {
    const ctx = makeCtx({
      env: { AI_ALLOWED_ORIGINS: 'https://livediagram.app , http://localhost:3002' },
      origin: 'http://localhost:3002',
    });
    const res = await handleAi(ctx);
    expect(res.status).not.toBe(403);
  });
});

describe('handleAi Clerk-only gate (AI_REQUIRE_CLERK)', () => {
  it('allows guest path (clerkUserId null) when AI_REQUIRE_CLERK is unset', async () => {
    const ctx = makeCtx({ env: {}, clerkUserId: null });
    const res = await handleAi(ctx);
    expect(res.status).not.toBe(401);
  });

  it('rejects guest path with 401 sign_in_required when AI_REQUIRE_CLERK="true"', async () => {
    const ctx = makeCtx({
      env: { AI_REQUIRE_CLERK: 'true' },
      clerkUserId: null,
    });
    const res = await handleAi(ctx);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'sign_in_required' });
  });

  it('allows Clerk-authenticated path when AI_REQUIRE_CLERK="true"', async () => {
    const ctx = makeCtx({
      env: { AI_REQUIRE_CLERK: 'true' },
      clerkUserId: 'user_abc',
    });
    const res = await handleAi(ctx);
    expect(res.status).not.toBe(401);
  });

  it('leaves guest path open when AI_REQUIRE_CLERK is any value other than literal "true"', async () => {
    // Explicit pin: only the string "true" enables the gate. A typo
    // like "yes" or "1" must NOT silently lock guests out.
    const ctx = makeCtx({
      env: { AI_REQUIRE_CLERK: 'yes' },
      clerkUserId: null,
    });
    const res = await handleAi(ctx);
    expect(res.status).not.toBe(401);
  });
});

describe('handleAi malformed bodies', () => {
  // A well-formed JSON value of the wrong shape is a 400, not a thrown 500.
  const bad = [
    ['null', 'null'],
    ['a bare string', '"hello"'],
    [
      'a non-array history',
      JSON.stringify({ mode: 'ask', prompt: 'p', elements: [], history: 'x' }),
    ],
    [
      'a null history turn',
      JSON.stringify({ mode: 'ask', prompt: 'p', elements: [], history: [null] }),
    ],
  ] as const;
  for (const [name, body] of bad) {
    it(`answers ${name} without throwing`, async () => {
      const res = await handleAi(makeCtx({ env: {}, body }));
      expect(res.status).toBeLessThan(500);
    });
  }
});

describe('handleAi provider (docs/specs/007-editor/ai-assistance.md, "Each feature has its own provider")', () => {
  it('keeps the assistant on OpenAI when a Google key sits beside it', async () => {
    const res = await handleAi(makeCtx({ env: { GOOGLE_AI_STUDIO_API_KEY: 'g' } }));
    expect(res.status).toBe(200);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(new Headers((init as RequestInit).headers).get('Authorization')).toBe('Bearer test-key');
    expect(JSON.parse((init as RequestInit).body as string).model).toBe('gpt-4o');
  });
});

// Counting elements bounded their number, not their size; one huge label
// filled the model's context on every call.
describe('handleAi element payload size', () => {
  const call = (label: string) =>
    handleAi(
      makeCtx({
        env: {},
        body: JSON.stringify({ mode: 'ask', prompt: 'p', elements: [{ id: 'a', label }] }),
      }),
    );

  it('refuses elements whose serialised size is past the cap, before calling the model', async () => {
    const res = await call('x'.repeat(300_000));
    expect(res.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('serves an ordinary diagram', async () => {
    const res = await call('A normal label');
    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
