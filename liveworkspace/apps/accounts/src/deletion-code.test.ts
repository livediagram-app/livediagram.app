import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Auth } from './auth.ts';
import { deleteAccount } from './delete-account.ts';
import {
  checkDeletionCode,
  checkDeletionCodeRoute,
  DELETION_CODE_TTL_SECONDS,
  newDeletionCode,
  sendDeletionCode,
  storeDeletionCode,
  type DeletionCodeConfig,
} from './deletion-code.ts';
import { addUser, testD1 } from './test-d1.ts';

// liveworkspace/docs/specs/003-accounts/sign-in.md "Closing an account": a code emailed to the account, checked before
// any app deletes anything, and spent by the close, which refuses without it.

let db: D1Database;
let sql: DatabaseSync;

// Better Auth's part, stood in for: introspection answers for Ada through livediagram's client, unless told otherwise.
let introspected: { status: number; body: unknown };
const auth = {
  handler: async () => Response.json(introspected.body, { status: introspected.status }),
  $context: Promise.resolve({
    internalAdapter: {
      deleteUser: async (id: string) => {
        sql.prepare('DELETE FROM "user" WHERE id = ?').run(id);
      },
    },
  }),
} as unknown as Auth;

const limiter = (success: boolean) => ({ limit: vi.fn(async () => ({ success })) });

const post = (path: string, body: unknown, authorization = `Basic ${btoa('livediagram:secret')}`) =>
  new Request(`https://liveworkspace.app/api/auth${path}`, {
    method: 'POST',
    headers: { authorization },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const rows = () => sql.prepare('SELECT identifier, value FROM verification').all();
const users = () => sql.prepare('SELECT id FROM "user"').all();

beforeEach(() => {
  ({ db, sql } = testD1());
  introspected = {
    status: 200,
    body: { active: true, sub: 'user_ada', client_id: 'livediagram' },
  };
  addUser(sql, { id: 'user_ada', email: 'Ada@Example.com' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com' });
});

describe('newDeletionCode', () => {
  it('is six digits, padded', () => {
    expect(newDeletionCode(() => Uint32Array.of(42))).toBe('000042');
    expect(newDeletionCode()).toMatch(/^[0-9]{6}$/);
  });

  it('draws again above the last whole million, so every code is as likely', () => {
    const draws = [0xffffffff, 1_234_567];
    expect(newDeletionCode(() => Uint32Array.of(draws.shift()!))).toBe('234567');
    expect(draws).toEqual([]);
  });
});

describe('checkDeletionCode', () => {
  it('keeps a right code when checking, and spends it when closing', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: false })).toBe('ok');
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: true })).toBe('ok');
    expect(rows()).toEqual([]);
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: true })).toBe('invalid_code');
  });

  it('is stored hashed, bound to the account', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    await storeDeletionCode(db, 'user_bea', '123456');
    const [ada, bea] = rows() as { identifier: string; value: string }[];
    expect(ada!.identifier).toBe('delete-account-otp-user_ada');
    expect(ada!.value).not.toContain('123456');
    expect(ada!.value.endsWith(':0')).toBe(true);
    expect(ada!.value).not.toBe(bea!.value);
    // Bea's code is not Ada's, though the digits match.
    expect(await checkDeletionCode(db, 'user_bea', '654321', { spend: false })).toBe(
      'invalid_code',
    );
  });

  it('dies on the third wrong try, taking the right code with it', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    expect(await checkDeletionCode(db, 'user_ada', '000000', { spend: false })).toBe(
      'invalid_code',
    );
    expect(await checkDeletionCode(db, 'user_ada', 'abc', { spend: false })).toBe('invalid_code');
    expect(await checkDeletionCode(db, 'user_ada', '111111', { spend: false })).toBe(
      'too_many_attempts',
    );
    expect(rows()).toEqual([]);
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: true })).toBe('invalid_code');
  });

  it('gives the tries back after a right check, so the close can follow it', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    await checkDeletionCode(db, 'user_ada', '000000', { spend: false });
    await checkDeletionCode(db, 'user_ada', '000001', { spend: false });
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: false })).toBe('ok');
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: true })).toBe('ok');
  });

  it('counts guesses sent at once one each', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    const guesses = ['000000', '000001', '000002', '000003', '000004'];
    const answers = await Promise.all(
      guesses.map((g) => checkDeletionCode(db, 'user_ada', g, { spend: false })),
    );
    // However they interleave, no more than the three tries are ever compared.
    expect(answers.filter((a) => a === 'invalid_code').length).toBeLessThanOrEqual(2);
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: false })).toBe(
      'invalid_code',
    );
  });

  it('refuses a code past its tries without comparing it', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    sql.prepare("UPDATE verification SET value = substr(value, 1, instr(value, ':')) || '3'").run();
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: false })).toBe(
      'too_many_attempts',
    );
    expect(rows()).toEqual([]);
  });

  it('runs out after ten minutes', async () => {
    const sent = Date.UTC(2026, 9, 30, 12);
    await storeDeletionCode(db, 'user_ada', '123456', sent);
    const later = sent + DELETION_CODE_TTL_SECONDS * 1000;
    expect(await checkDeletionCode(db, 'user_ada', '123456', { spend: false, now: later })).toBe(
      'invalid_code',
    );
    expect(rows()).toEqual([]);
  });

  it('keeps only the newest code', async () => {
    await storeDeletionCode(db, 'user_ada', '111111');
    await storeDeletionCode(db, 'user_ada', '222222');
    expect(rows()).toHaveLength(1);
    expect(await checkDeletionCode(db, 'user_ada', '111111', { spend: false })).toBe(
      'invalid_code',
    );
    expect(await checkDeletionCode(db, 'user_ada', '222222', { spend: false })).toBe('ok');
  });

  it('lets only one of two closes sent at once spend a code', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    // Another close's try lands between this one's count and its spend.
    const racing = {
      ...db,
      prepare: (query: string) => {
        if (query.startsWith('DELETE FROM verification WHERE id = ? AND value = ?')) {
          sql
            .prepare("UPDATE verification SET value = substr(value, 1, instr(value, ':')) || '2'")
            .run();
        }
        return db.prepare(query);
      },
    } as D1Database;
    expect(await checkDeletionCode(racing, 'user_ada', '123456', { spend: true })).toBe(
      'invalid_code',
    );
  });
});

describe('the deletion code doors', () => {
  const sent: { to: string; code: string; app: unknown }[] = [];
  const config = (over: Partial<DeletionCodeConfig> = {}): DeletionCodeConfig => ({
    auth,
    send: async (to, code, app) => void sent.push({ to, code, app }),
    ...over,
  });

  beforeEach(() => {
    sent.length = 0;
  });

  it('emails a new code to the account’s own address, in the asking app’s brand', async () => {
    sql
      .prepare(
        `INSERT INTO "oauthClient" ("id", "clientId", "redirectUris") VALUES ('c1', 'livediagram', '[]')`,
      )
      .run();
    sql.prepare(`INSERT INTO oauth_client_app VALUES ('livediagram', 'livediagram.app')`).run();
    const emailLimiter = limiter(true);
    const res = await sendDeletionCode(
      post('/delete-account/code', { token: 't', email: 'mallory@example.com' }),
      db,
      config({ emailLimiter }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(sent).toEqual([
      { to: 'Ada@Example.com', code: expect.stringMatching(/^[0-9]{6}$/), app: 'livediagram.app' },
    ]);
    expect(emailLimiter.limit).toHaveBeenCalledWith({ key: 'email:ada@example.com' });
    expect(await checkDeletionCode(db, 'user_ada', sent[0]!.code, { spend: false })).toBe('ok');
  });

  it('sends no code over the address’s limit, or for an account that is gone', async () => {
    const limited = await sendDeletionCode(
      post('/delete-account/code', { token: 't' }),
      db,
      config({ emailLimiter: limiter(false) }),
    );
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate_limited' });

    introspected.body = { active: true, sub: 'user_gone', client_id: 'livediagram' };
    const gone = await sendDeletionCode(post('/delete-account/code', { token: 't' }), db, config());
    expect(gone.status).toBe(404);
    expect(sent).toEqual([]);
    expect(rows()).toEqual([]);
  });

  it('needs the app’s credentials and a live token issued to it', async () => {
    const bare = await sendDeletionCode(
      post('/delete-account/code', { token: 't' }, 'Bearer t'),
      db,
      config(),
    );
    expect(bare.status).toBe(400);
    const array = await sendDeletionCode(post('/delete-account/code', '["t"]'), db, config());
    expect(array.status).toBe(400);

    introspected = { status: 401, body: {} };
    const wrongSecret = await sendDeletionCode(
      post('/delete-account/code', { token: 't' }),
      db,
      config(),
    );
    expect(await wrongSecret.json()).toEqual({ error: 'invalid_client' });

    introspected = { status: 200, body: { active: true, sub: 'user_ada', client_id: 'other' } };
    const otherApp = await sendDeletionCode(
      post('/delete-account/code', { token: 't' }),
      db,
      config(),
    );
    expect(await otherApp.json()).toEqual({ error: 'invalid_token' });
    expect(sent).toEqual([]);
  });

  it('checks a code without spending it, per account and limited', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    const checkLimiter = limiter(true);
    const wrong = await checkDeletionCodeRoute(
      post('/delete-account/check', { token: 't', code: '000000' }),
      db,
      config({ checkLimiter }),
    );
    expect(wrong.status).toBe(403);
    expect(await wrong.json()).toEqual({ error: 'invalid_code' });
    const right = await checkDeletionCodeRoute(
      post('/delete-account/check', { token: 't', code: '123456' }),
      db,
      config({ checkLimiter }),
    );
    expect(await right.json()).toEqual({ ok: true });
    expect(checkLimiter.limit).toHaveBeenCalledWith({ key: 'account:user_ada' });
    expect(rows()).toHaveLength(1);

    const limited = await checkDeletionCodeRoute(
      post('/delete-account/check', { token: 't', code: '123456' }),
      db,
      config({ checkLimiter: limiter(false) }),
    );
    expect(limited.status).toBe(429);
    const unauthorised = await checkDeletionCodeRoute(
      post('/delete-account/check', { code: '123456' }),
      db,
      config(),
    );
    expect(unauthorised.status).toBe(400);
  });
});

describe('closing an account needs the code', () => {
  const close = (body: unknown, checkLimiter = limiter(true)) =>
    deleteAccount(post('/delete-account', body), db, { auth, checkLimiter });

  it('closes nothing without the code, or with a wrong one', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    expect((await close({ token: 't' })).status).toBe(403);
    const wrong = await close({ token: 't', code: '000000' });
    expect(await wrong.json()).toEqual({ error: 'invalid_code' });
    expect(users()).toHaveLength(2);
  });

  it('closes nothing over the account’s limit', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    const res = await close({ token: 't', code: '123456' }, limiter(false));
    expect(res.status).toBe(429);
    expect(users()).toHaveLength(2);
  });

  it('closes the account with the right code, and spends it', async () => {
    await storeDeletionCode(db, 'user_ada', '123456');
    const res = await close({ token: 't', code: '123456' });
    expect(await res.json()).toEqual({ deleted: true });
    expect(users()).toEqual([{ id: 'user_bea' }]);
    expect(rows()).toEqual([]);
  });
});
