// A D1 outage (liveworkspace/docs/specs/002-architecture/architecture.md "When a request fails"): accounts answers
// it itself, retryable, never the runtime's bare error page, and never as someone signed out.
import { unavailableD1 } from '@liveworkspace/api-kit/testing/unavailable-d1';
import { makeSignature } from 'better-auth/crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import worker from './index.ts';

const BASE = 'https://liveworkspace.app';

const env = {
  BASE_URL: BASE,
  BETTER_AUTH_SECRET: 's'.repeat(40),
  ENVIRONMENT: 'production',
  AUTH_DB: unavailableD1(),
} as unknown as Env;
const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;
// A signed-in browser's session cookie, so the session lookup reaches D1. Better Auth checks the signature first,
// and a request without a valid one is simply signed out, with no database call to fail.
const sessionCookie = async () => {
  const token = 'session-token';
  const signed = `${token}.${await makeSignature(token, env.BETTER_AUTH_SECRET)}`;
  return `__Secure-better-auth.session_token=${encodeURIComponent(signed)}`;
};
const call = async (path: string) =>
  worker.fetch(
    new Request(`${BASE}${path}`, { headers: { Cookie: await sessionCookie(), Origin: BASE } }),
    env,
    ctx,
  );

afterEach(() => vi.restoreAllMocks());

describe('accounts when D1 is unavailable', () => {
  it.each([
    ['/api/auth/get-session', 'Get.Auth.GetSession'],
    ['/api/auth/workspace-token', 'Get.Auth.WorkspaceToken'],
    ['/api/account/teams', 'Get.Account.Teams'],
  ])('answers %s 503 storage_unavailable, never cached', async (path, route) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await call(path);

    expect(res.status).toBe(503);
    expect(res.headers.get('Retry-After')).toBe('5');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: 'storage_unavailable' });
    expect(error).toHaveBeenCalledWith(`[d1] unavailable route=${route}`, expect.any(Error));
  });
});
