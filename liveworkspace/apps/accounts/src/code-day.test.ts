// An address's day of email codes (liveworkspace/docs/specs/003-accounts/sign-in.md "A day's codes per address"):
// checks that never signed in lock code sign-in for the day, sends are capped, both counted per address in D1.
import { betterAuth } from 'better-auth';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authOptions, SEND_CODE_PATH, SIGN_IN_CODE_PATH } from './auth-options.ts';
import {
  addressKey,
  clearChecks,
  CODE_CHECKS_PER_DAY,
  CODE_DAY_MS,
  CODE_DAY_SWEEP_LIMIT,
  CODE_SENDS_PER_DAY,
  CODE_SIGN_IN_LOCKED,
  codeRefusal,
  countSend,
  emailOfRequest,
  refuseSend,
  sweepCodeDays,
  takeCheck,
  TOO_MANY_CODES,
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
    .get(await addressKey(email)) as
    { windowStart: number; sends: number; failures: number } | undefined;

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

describe('checks', () => {
  it('lock the address after the day’s checks, until the window ends', async () => {
    const key = await addressKey('a@example.com');
    const now = 1_000_000;
    for (let i = 0; i < CODE_CHECKS_PER_DAY; i++)
      expect(await takeCheck(db, key, now + i)).toBeNull();
    expect(await takeCheck(db, key, now + 100)).toBe(CODE_SIGN_IN_LOCKED);
    expect(await refuseSend(db, key, now + 100)).toBe(CODE_SIGN_IN_LOCKED);
    // A day after the first check, the window starts again.
    expect(await refuseSend(db, key, now + CODE_DAY_MS)).toBeNull();
    expect(await takeCheck(db, key, now + CODE_DAY_MS)).toBeNull();
    expect((await rowOf('a@example.com'))!).toMatchObject({
      windowStart: now + CODE_DAY_MS,
      failures: 1,
      sends: 0,
    });
  });

  it('count each of a burst sent at once, so none share a place', async () => {
    const key = await addressKey('a@example.com');
    const answers = await Promise.all(
      Array.from({ length: CODE_CHECKS_PER_DAY + 5 }, () => takeCheck(db, key)),
    );
    expect(answers.filter((a) => a === null)).toHaveLength(CODE_CHECKS_PER_DAY);
    expect(answers.filter((a) => a === CODE_SIGN_IN_LOCKED)).toHaveLength(5);
  });

  it('are cleared by a check that signed in', async () => {
    const key = await addressKey('a@example.com');
    for (let i = 0; i < 5; i++) await takeCheck(db, key);
    await clearChecks(db, key);
    expect((await rowOf('a@example.com'))!.failures).toBe(0);
  });
});

describe('sends', () => {
  it('stop at the day’s codes, and start again with the next window', async () => {
    const key = await addressKey('a@example.com');
    const now = 5_000_000;
    expect(await refuseSend(db, key, now)).toBeNull();
    for (let i = 0; i < CODE_SENDS_PER_DAY; i++) await countSend(db, key, now + i);
    expect(await refuseSend(db, key, now + 50)).toBe(TOO_MANY_CODES);
    expect(await refuseSend(db, key, now + CODE_DAY_MS)).toBeNull();
    await countSend(db, key, now + CODE_DAY_MS);
    expect((await rowOf('a@example.com'))!).toMatchObject({ sends: 1, failures: 0 });
  });

  it('and checks share one window', async () => {
    const key = await addressKey('a@example.com');
    await countSend(db, key, 10);
    await takeCheck(db, key, 20);
    expect((await rowOf('a@example.com'))!).toMatchObject({
      windowStart: 10,
      sends: 1,
      failures: 1,
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
    const locked = codeRefusal(CODE_SIGN_IN_LOCKED);
    expect(locked.status).toBe(429);
    expect(locked.headers.get('cache-control')).toBe('no-store');
    expect(await locked.json()).toMatchObject({ code: CODE_SIGN_IN_LOCKED });
    expect(await codeRefusal(TOO_MANY_CODES).json()).toMatchObject({ code: TOO_MANY_CODES });
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

  const send = (
    email: string,
    headers: Record<string, string> = { 'x-captcha-response': 'ok' },
  ) => {
    const request = codeRequest(SEND_CODE_PATH, { email, type: 'sign-in' });
    for (const [name, value] of Object.entries(headers)) request.headers.set(name, value);
    return withCodeDay(request, db, true, () => auth.handler(request));
  };
  const check = (email: string, otp: string) => {
    const request = codeRequest(SIGN_IN_CODE_PATH, { email, otp });
    return withCodeDay(request, db, false, () => auth.handler(request));
  };
  const wrong = (code: string) => (code === '000000' ? '111111' : '000000');

  it('locks code sign-in after the day’s wrong codes, even against the right one, and mails no more', async () => {
    const email = 'ada@example.com';
    let guesses = 0;
    while (guesses < CODE_CHECKS_PER_DAY) {
      expect((await send(email)).status).toBe(200);
      const code = codes.get(email)!;
      for (let i = 0; i < 3 && guesses < CODE_CHECKS_PER_DAY; i++, guesses++) {
        expect((await check(email, wrong(code))).status).not.toBe(429);
      }
    }
    codes.clear();
    const refused = await send(email);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ code: CODE_SIGN_IN_LOCKED });
    expect(codes.size).toBe(0);
    // A code sent before the lock still can't sign in.
    sql.prepare('UPDATE sign_in_code_limit SET failures = 0').run();
    expect((await send(email)).status).toBe(200);
    const code = codes.get(email)!;
    sql.prepare(`UPDATE sign_in_code_limit SET failures = ${CODE_CHECKS_PER_DAY}`).run();
    const locked = await check(email, code);
    expect(locked.status).toBe(429);
    expect(await locked.json()).toMatchObject({ code: CODE_SIGN_IN_LOCKED });
  });

  it('forgets wrong codes once one signs in', async () => {
    const email = 'bea@example.com';
    await send(email);
    const code = codes.get(email)!;
    expect((await check(email, wrong(code))).status).toBe(400);
    expect((await check(email, code)).status).toBe(200);
    expect((await rowOf(email))!.failures).toBe(0);
  });

  it('counts only sends Better Auth accepted, so a failed Turnstile uses up nothing', async () => {
    vi.stubGlobal('fetch', async () => Response.json({ success: false }));
    const email = 'cy@example.com';
    expect((await send(email)).ok).toBe(false);
    expect(await rowOf(email)).toBeUndefined();
    vi.stubGlobal('fetch', async () => Response.json({ success: true }));
    for (let i = 0; i < CODE_SENDS_PER_DAY; i++) expect((await send(email)).status).toBe(200);
    const refused = await send(email);
    expect(refused.status).toBe(429);
    expect(await refused.json()).toMatchObject({ code: TOO_MANY_CODES });
  });

  it('leaves a body with no email to Better Auth, uncounted', async () => {
    const request = codeRequest(SIGN_IN_CODE_PATH, { otp: '123456' });
    const answer = await withCodeDay(request, db, false, () => auth.handler(request));
    expect(answer.status).toBe(400);
    expect(sql.prepare('SELECT count(*) AS n FROM sign_in_code_limit').get()).toEqual({ n: 0 });
  });

  it('logs a count that fails after the answer, and keeps the answer', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const email = 'dee@example.com';
    const request = codeRequest(SEND_CODE_PATH, { email, type: 'sign-in' });
    const broken = {
      prepare: (query: string) =>
        query.startsWith('SELECT')
          ? db.prepare(query)
          : { bind: () => ({ first: () => Promise.reject(new Error('down')) }) },
    } as unknown as D1Database;
    const answer = await withCodeDay(request, broken, true, async () =>
      Response.json({ ok: true }),
    );
    expect(answer.status).toBe(200);
    expect(error).toHaveBeenCalledWith('[code-day] count failed', expect.any(Error));
  });
});
