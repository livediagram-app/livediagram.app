// Better Auth's schema check, in CI rather than on a Worker's first request (liveworkspace/docs/specs/003-accounts/sign-in.md
// "Deploys"): the migrations must still make every table and column Better Auth writes, and a request must never wait
// on the check.
import { betterAuth } from 'better-auth';
import { describe, expect, it } from 'vitest';
import { authOptions } from './auth-options.ts';
import { testD1 } from './test-d1.ts';

function build(db: D1Database) {
  return betterAuth(
    authOptions(
      {
        baseUrl: 'https://www.liveworkspace.app',
        secret: 'test-secret-that-is-at-least-32-characters',
        resources: ['https://www.liveplanner.app/api'],
        turnstileSecretKey: 'turnstile',
        adminToken: 'admin',
        google: null,
        sendCode: async () => {},
        onUserCreated: async () => {},
      },
      db,
    ),
  );
}

describe('Better Auth schema check', () => {
  it('passes against a database built from the migrations', async () => {
    const ctx = await build(testD1().db).$context;
    expect(ctx.explicitSchemaCheck).toBeTypeOf('function');
    await expect(ctx.explicitSchemaCheck!()).resolves.toBeUndefined();
  });

  it('fails when a migration leaves out a table Better Auth writes', async () => {
    const { db, sql } = testD1();
    sql.exec('DROP TABLE "oauthConsent"');
    const ctx = await build(db).$context;
    await expect(ctx.explicitSchemaCheck!()).rejects.toThrow(/oauthConsent/);
  });

  it('never runs on a request', async () => {
    const { db, sql } = testD1();
    sql.exec('DROP TABLE "oauthConsent"');
    const auth = build(db);
    expect((await auth.$context).checkSchema).toBeUndefined();
    // A route that doesn't touch the missing table answers, where the runtime check would refuse it.
    const res = await auth.handler(
      new Request('https://www.liveworkspace.app/api/auth/get-session'),
    );
    expect(res.status).toBe(200);
  });
});

// A Google sign-in finds its account by provider and Google's id (0021): without the index, a full read of the table.
describe("Better Auth's account lookup", () => {
  it('finds a Google account by its index, not by reading every account', async () => {
    const { db, sql } = testD1();
    const prepared: string[] = [];
    const prepare = db.prepare.bind(db);
    db.prepare = (query: string) => {
      prepared.push(query);
      return prepare(query);
    };
    const ctx = await build(db).$context;
    await ctx.internalAdapter.findAccountByKey({ providerId: 'google', accountId: 'g-1' });
    const lookup = prepared.find((q) => /from "account"/i.test(q) && /"accountId"/.test(q));
    expect(lookup).toBeDefined();
    const plan = sql
      .prepare(`EXPLAIN QUERY PLAN ${lookup!}`)
      .all('google', 'g-1', 1)
      .map((r) => String((r as { detail: string }).detail));
    expect(plan.join('\n')).toContain('account_provider_account_idx');
    expect(plan.filter((l) => /^SCAN account\b/.test(l))).toEqual([]);
  });
});
