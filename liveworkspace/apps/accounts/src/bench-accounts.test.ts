import { describe, expect, it, vi } from 'vitest';
import { BENCH_ACCOUNTS_MAX, BENCH_ACCOUNTS_PATH, benchAccounts } from './bench-accounts.ts';
import type { Env } from './env.ts';
import { testD1 } from './test-d1.ts';
import { verifyApiToken } from './tokens.ts';

// crypto.subtle.timingSafeEqual is the Workers runtime's own; Node's crypto has none.
vi.mock('./secrets.ts', () => ({ sameSecret: async (a: string, b: string) => a === b }));

const ADMIN = 'admin-token';

function setup(environment: Env['ENVIRONMENT'] = 'development') {
  const { db, sql } = testD1();
  const env = { ENVIRONMENT: environment, ADMIN_TOKEN: ADMIN, AUTH_DB: db } as unknown as Env;
  const call = (body: unknown, token = ADMIN) =>
    benchAccounts(
      new Request(`http://localhost${BENCH_ACCOUNTS_PATH}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
      env,
    );
  return { db, sql, call };
}

describe('bench accounts', () => {
  it('makes an account and a working API token for each run', async () => {
    const { db, call } = setup();
    const res = await call({ count: 3, name: 'bench r1' });
    expect(res.status).toBe(201);
    const { accounts } = await res.json<{ accounts: { userId: string; token: string }[] }>();
    expect(accounts).toHaveLength(3);
    expect(new Set(accounts.map((a) => a.userId)).size).toBe(3);
    for (const a of accounts) {
      expect(a.userId).toMatch(/^user_[0-9a-f]{32}$/);
      expect(await verifyApiToken(db, a.token)).toMatchObject({
        userId: a.userId,
        readOnly: false,
      });
    }
  });

  it('does not exist outside development, and needs the admin token', async () => {
    expect((await setup('production').call({ count: 1 })).status).toBe(404);
    expect((await setup('staging').call({ count: 1 })).status).toBe(404);
    expect((await setup().call({ count: 1 }, 'wrong')).status).toBe(401);
  });

  it('refuses a count out of range', async () => {
    const { call } = setup();
    expect((await call(null)).status, 'a null body').toBe(400);
    for (const count of [0, -1, 1.5, BENCH_ACCOUNTS_MAX + 1, '3', undefined]) {
      expect((await call({ count })).status, String(count)).toBe(400);
    }
  });
});
