import { describe, expect, it, vi } from 'vitest';
import type { Env } from './env.ts';
import { overCodeLimit } from './rate-limit.ts';

function limiter(success: boolean) {
  return { limit: vi.fn(async () => ({ success })) };
}

function env(ip: boolean, email: boolean) {
  return { CODE_IP_LIMITER: limiter(ip), CODE_EMAIL_LIMITER: limiter(email) } as unknown as Env & {
    CODE_IP_LIMITER: ReturnType<typeof limiter>;
    CODE_EMAIL_LIMITER: ReturnType<typeof limiter>;
  };
}

function request(body: unknown) {
  return new Request('https://accounts.liveworkspace.app/api/auth/x', {
    method: 'POST',
    headers: { 'cf-connecting-ip': '203.0.113.9' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('overCodeLimit', () => {
  it('counts sends per IP and per normalised email', async () => {
    const e = env(true, true);
    await expect(overCodeLimit(request({ email: ' Ada@Example.com ' }), e, true)).resolves.toBe(
      false,
    );
    expect(e.CODE_IP_LIMITER.limit).toHaveBeenCalledWith({ key: 'ip:203.0.113.9' });
    expect(e.CODE_EMAIL_LIMITER.limit).toHaveBeenCalledWith({ key: 'email:ada@example.com' });
  });

  it('refuses when the IP is over its limit, without counting the email', async () => {
    const e = env(false, true);
    await expect(overCodeLimit(request({ email: 'a@example.com' }), e, true)).resolves.toBe(true);
    expect(e.CODE_EMAIL_LIMITER.limit).not.toHaveBeenCalled();
  });

  it('refuses when the email is over its limit', async () => {
    await expect(
      overCodeLimit(request({ email: 'a@example.com' }), env(true, false), true),
    ).resolves.toBe(true);
  });

  it('checks only the IP when verifying a code', async () => {
    const e = env(true, false);
    await expect(overCodeLimit(request({ email: 'a@example.com' }), e, false)).resolves.toBe(false);
    expect(e.CODE_EMAIL_LIMITER.limit).not.toHaveBeenCalled();
  });

  it('leaves a body with no email to Better Auth', async () => {
    await expect(overCodeLimit(request('not json'), env(true, false), true)).resolves.toBe(false);
  });

  it('leaves the body readable for the handler', async () => {
    const req = request({ email: 'a@example.com' });
    await overCodeLimit(req, env(true, true), true);
    await expect(req.json()).resolves.toEqual({ email: 'a@example.com' });
  });
});
