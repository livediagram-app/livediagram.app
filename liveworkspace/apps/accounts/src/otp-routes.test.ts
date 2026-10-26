// The emailed sign-in code (liveworkspace/docs/accounts.md): only the sign-in route may check it. Better Auth's
// `/email-otp/check-verification-otp` reads the attempt count and writes it back in two steps, so guesses sent at once
// all count as one, and a code found that way still signs in. That route, and the code flows nothing here uses
// (no passwords, no email change), are off.
import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authOptions, UNUSED_CODE_PATHS } from './auth-options.ts';
import { testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace-gateway.liveworkspace-easing509.workers.dev';
const JSON_HEADERS = { 'content-type': 'application/json', origin: BASE };

let codes: Map<string, string>;
let auth: ReturnType<typeof build>;

function build(db: D1Database) {
  return betterAuth(
    authOptions(
      {
        baseUrl: BASE,
        secret: 'test-secret-that-is-at-least-32-characters',
        resources: ['https://liveplanner.app/api'],
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async (email, code) => void codes.set(email, code),
        onUserCreated: async () => {},
      },
      db,
    ),
  );
}

beforeEach(() => {
  codes = new Map();
  // Turnstile always passes.
  vi.stubGlobal('fetch', async () => Response.json({ success: true }));
  auth = build(testD1().db);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method: 'POST',
      headers: { ...JSON_HEADERS, ...headers },
      body: JSON.stringify(body),
    }),
  );

describe('the emailed sign-in code', () => {
  it('can’t be checked outside signing in, so guesses can’t race the attempt count', async () => {
    const email = 'ada@example.com';
    const sent = await post(
      '/email-otp/send-verification-otp',
      { email, type: 'sign-in' },
      { 'x-captcha-response': 'ok' },
    );
    expect(sent.status).toBe(200);
    const code = codes.get(email)!;
    const wrong = code === '000000' ? '111111' : '000000';
    const guesses = await Promise.all(
      Array.from({ length: 12 }, () =>
        post('/email-otp/check-verification-otp', { email, type: 'sign-in', otp: wrong }),
      ),
    );
    expect(guesses.map((r) => r.status)).toEqual(Array(12).fill(404));
    const check = await post('/email-otp/check-verification-otp', {
      email,
      type: 'sign-in',
      otp: code,
    });
    expect(check.status).toBe(404);
    // Signing in still takes the code.
    expect((await post('/sign-in/email-otp', { email, otp: code })).status).toBe(200);
  });

  it('turns off every code route but sending one and signing in with it', async () => {
    for (const path of UNUSED_CODE_PATHS)
      expect((await post(path, { email: 'bea@example.com', otp: '123456' })).status).toBe(404);
  });
});
