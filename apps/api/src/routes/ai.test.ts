import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleAi } from './ai';
import type { RouteContext } from './context';
import type { Env } from '../types';

// These tests pin the two spend-DoS gates on POST /api/ai (spec/25):
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
}): RouteContext {
  const headers = new Headers();
  if (opts.origin !== null && opts.origin !== undefined) {
    headers.set('Origin', opts.origin);
  }
  const request = new Request('https://api.example.com/api/ai', {
    method: 'POST',
    headers,
    body: JSON.stringify({ mode: 'generate', prompt: 'p', elements: [], tabName: 't' }),
  });
  return {
    request,
    env: { OPENAI_API_KEY: 'sk-test', ...opts.env } as Env,
    url: new URL(request.url),
    segments: ['api', 'ai'],
    clerkUserId: opts.clerkUserId ?? null,
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
