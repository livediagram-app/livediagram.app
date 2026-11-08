// An address's day of email codes (liveworkspace/docs/specs/003-accounts/sign-in.md "A day's codes per address"):
// 20 codes a day per address, counted in D1 once Better Auth accepted each, so at most 60 guesses a day at it.
// Checks are never counted, so nobody can lock an address out by guessing.
import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authOptions, SEND_CODE_PATH, SIGN_IN_CODE_PATH } from './auth-options.ts';
import {
  addressKey,
  CODE_DAY_MS,
  CODE_DAY_SWEEP_LIMIT,
  CODE_SENDS_PER_DAY,
  countSend,
  emailOfRequest,
  overSends,
  sweepCodeDays,
  TOO_MANY_CODES,
  tooManyCodes,
  withCodeDay,
} from './code-day.ts';
import { testD1 } from './test-d1.ts';

const BASE = 'https://liveworkspace.app';
let db: D1Database;
let sql: ReturnType<typeof testD1>['sql'];

beforeEach(() => {
  ({ db, sql } = testD1());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const rowOf = async (email: string) =>
  sql
    .prepare('SELECT * FROM sign_in_code_limit WHERE emailHash = ?')
    .get(await addressKey(email)) as { windowStart: number; sends: number } | undefined;

const codeRequest = (path: string, body: unknown) =>
  new Request(`${BASE}/api/auth${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('the key an address is counted under', () => {
  it('is the SHA-256 of the trimmed, lower-case address, never the address', async () => {
    const key = await addressKey(' Ada@Example.com ');
    expect(key).toBe(await addressKey('ada@example.com'));
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is read from a clone of the body, leaving it for Better Auth', async () => {
    const request = codeRequest(SEND_CODE_PATH, { email: 'a@example.com' });
    expect(await emailOfRequest(request)).toBe('a@example.com');
    await expect(request.json()).resolves.toEqual({ email: 'a@example.com' });
    expect(await emailOfRequest(codeRequest(SEND_CODE_PATH, 'not json'))).toBeNull();
    expect(await emailOfRequest(codeRequest(SEND_CODE_PATH, { email: '  ' }))).toBeNull();
    expect(await emailOfRequest(codeRequest(SEND_CODE_PATH, { email: 7 }))).toBeNull();
  });
});

describe('sends', () => {
  it('stop at the day’s codes, and start again with the next window', async () => {
    const key = await addressKey('a@example.com');
    const now = 5_000_000;
    expect(await overSends(db, key, now)).toBe(false);
    for (let i = 0; i < CODE_SENDS_PER_DAY; i++) await countSend(db, key, now + i);
    expect(await overSends(db, key, now + 50)).toBe(true);
    expect(await overSends(db, key, now + CODE_DAY_MS)).toBe(false);
    await countSend(db, key, now + CODE_DAY_MS);
    expect((await rowOf('a@example.com'))!).toEqual({
      emailHash: key,
      windowStart: now + CODE_DAY_MS,
      sends: 1,
    });
  });
});

describe('the hourly sweep', () => {
  it('deletes windows that ended, the oldest first, up to its limit', async () => {
    const now = 10 * CODE_DAY_MS;
    await countSend(db, await addressKey('old@example.com'), now - CODE_DAY_MS - 1);
    await countSend(db, await addressKey('new@example.com'), now - 1);
    expect(await sweepCodeDays(db, now)).toBe(1);
    expect(await rowOf('old@example.com')).toBeUndefined();
    expect(await rowOf('new@example.com')).toBeDefined();
    expect(await sweepCodeDays(db, now)).toBe(0);
    expect(CODE_DAY_SWEEP_LIMIT).toBe(5_000);
  });
});

describe('the refusal', () => {
  it('is a 429 the sign-in page names by its code', async () => {
    const refused = tooManyCodes();
    expect(refused.status).toBe(429);
    expect(refused.headers.get('cache-control')).toBe('no-store');
    expect(await refused.json()).toMatchObject({ code: TOO_MANY_CODES });
  });
});

// Through Better Auth itself, as index.ts runs it.
describe('with Better Auth', () => {
  let codes: Map<string, string>;
  const build = () =>
    betterAuth(
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
  let auth: ReturnType<typeof build>;

  beforeEach(() => {
    codes = new Map();
    // Turnstile always passes.
    vi.stubGlobal('fetch', async () => Response.json({ success: true }));
    auth = build();
  });

  const send = (email: string) => {
    const request = codeRequest(SEND_CODE_PATH, { email, type: 'sign-in' });
    request.headers.set('x-captcha-response', 'ok');
    return withCodeDay(request, db, () => auth.handler(request));
  };
  const check = (email: string, otp: string) =>
    auth.handler(codeRequest(SIGN_IN_CODE_PATH, { email, otp }));
  const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

  it('mails no more than the day’s codes, and the last one still signs in', async () => {
    const email = 'ada@example.com';
    for (let i = 0; i < CODE_SENDS_PER_DAY; i++) expect((await send(email)).status).toBe(200);
    const last = codes.get(email)!;
    codes.clear();
    const refused = await send(email);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ code: TOO_MANY_CODES });
    expect(codes.size).toBe(0);
    expect((await check(email, last)).status).toBe(200);
  });

  it('never counts checks, so wrong codes lock nobody out', async () => {
    const email = 'bea@example.com';
    await send(email);
    for (let i = 0; i < 30; i++) await check(email, '000000');
    expect((await rowOf(email))!.sends).toBe(1);
    expect((await send(email)).status).toBe(200);
    const code = codes.get(email)!;
    expect((await check(email, wrong(code))).status).toBe(400);
    expect((await check(email, code)).status).toBe(200);
  });

  it('counts only sends Better Auth accepted, so a failed Turnstile uses up nothing', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ success: false }));
    const email = 'cy@example.com';
    expect((await send(email)).ok).toBe(false);
    expect(await rowOf(email)).toBeUndefined();
  });

  it('leaves a body with no email to Better Auth, uncounted', async () => {
    const request = codeRequest(SEND_CODE_PATH, { type: 'sign-in' });
    const answer = await withCodeDay(request, db, () => auth.handler(request));
    expect(answer.status).toBe(400);
    expect(sql.prepare('SELECT count(*) AS n FROM sign_in_code_limit').get()).toEqual({ n: 0 });
  });

  it('logs a count that fails after the answer, and keeps the answer', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = codeRequest(SEND_CODE_PATH, { email: 'dee@example.com', type: 'sign-in' });
    const broken = {
      prepare: (query: string) =>
        query.startsWith('SELECT')
          ? db.prepare(query)
          : { bind: () => ({ run: () => Promise.reject(new Error('down')) }) },
    } as unknown as D1Database;
    const answer = await withCodeDay(request, broken, async () => Response.json({ ok: true }));
    expect(answer.status).toBe(200);
    expect(error).toHaveBeenCalledWith('[code-day] count failed', expect.any(Error));
  });
});
