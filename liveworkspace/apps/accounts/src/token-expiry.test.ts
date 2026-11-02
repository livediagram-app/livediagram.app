import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tokenExpiringEmail } from './email.ts';
import { startLifecycle } from './lifecycle.ts';
import { flushServerEvents, waitingServerEvents } from './telemetry.ts';
import { addUser, testD1 } from './test-d1.ts';
import {
  sweepExpiringTokens,
  TOKEN_EXPIRY_SWEEP_LIMIT,
  TOKEN_EXPIRY_WARNING_MS,
  type TokenExpiryEmail,
} from './token-expiry.ts';
import { mintApiToken, revokeApiToken } from './tokens.ts';

const BASE = 'https://liveworkspace.app';
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 23, 9, 17);
// No send window here, for the tests of what goes rather than when: "the send window" below has when.
const env = {
  BASE_URL: BASE,
  TELEMETRY_URL: 'https://liveworkspace.app/api/telemetry',
  EMAIL_SEND_WINDOW: 'always',
};

let db: D1Database;
let sql: DatabaseSync;
let sent: TokenExpiryEmail[];
const send = async (email: TokenExpiryEmail) => {
  sent.push(email);
};

// A token straight into the table, expiring at `expiresAt`.
function addToken(id: string, userId: string, expiresAt: number, name = id) {
  sql
    .prepare(
      `INSERT INTO api_token (id, userId, tokenHash, name, readOnly, createdAt, expiresAt)
       VALUES (?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(id, userId, `hash-${id}`, name, expiresAt - 180 * DAY, expiresAt);
}

const warnedAt = (id: string) =>
  (
    sql.prepare('SELECT expiryWarnedAt FROM api_token WHERE id = ?').get(id) as {
      expiryWarnedAt: number | null;
    }
  ).expiryWarnedAt;

beforeEach(() => {
  ({ db, sql } = testD1());
  sent = [];
  addUser(sql, { id: 'user_ada', email: 'ada@example.com' });
  addUser(sql, { id: 'user_bea', email: 'bea@example.com', verified: false });
});
afterEach(async () => {
  await flushServerEvents({});
});

describe('the expiring-token warning', () => {
  it('warns once for a live token that expires within a week, and only that one', async () => {
    addToken('soon', 'user_ada', NOW + 3 * DAY, 'CI deploy');
    addToken('later', 'user_ada', NOW + TOKEN_EXPIRY_WARNING_MS + 2 * DAY);
    addToken('gone', 'user_ada', NOW - DAY);
    addToken('revoked', 'user_ada', NOW + DAY);
    await revokeApiToken(db, 'user_ada', 'revoked', NOW - DAY);

    expect(await sweepExpiringTokens(db, env, send, NOW)).toEqual({ sent: 1, failed: 0 });
    expect(sent).toEqual([
      { to: 'ada@example.com', ...tokenExpiringEmail(BASE, 'CI deploy', NOW + 3 * DAY) },
    ]);
    expect(warnedAt('soon')).toBe(NOW);
    expect(warnedAt('later')).toBeNull();

    // The next day's run doesn't warn it again.
    expect(await sweepExpiringTokens(db, env, send, NOW + DAY)).toEqual({ sent: 0, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it('warns a token made through the API a week before its six months are up', async () => {
    const token = await mintApiToken(db, 'user_ada', { name: 'MCP', readOnly: false }, NOW);
    await sweepExpiringTokens(db, env, send, token!.expiresAt - TOKEN_EXPIRY_WARNING_MS - 1);
    expect(sent).toEqual([]);
    await sweepExpiringTokens(db, env, send, token!.expiresAt - TOKEN_EXPIRY_WARNING_MS);
    expect(sent.map((e) => e.subject)).toEqual(['Your liveworkspace API token expires soon']);
  });

  it('names the token and the day, and links to the Tokens page', () => {
    const email = tokenExpiringEmail(BASE + '/', 'CI <deploy>', Date.UTC(2026, 0, 5));
    expect(email.subject).toBe('Your liveworkspace API token expires soon');
    expect(email.html).toContain('<strong>CI &#60;deploy&#62;</strong> expires on January 5, 2026');
    expect(email.html).toContain(`href="${BASE}/explorer?settings=tokens"`);
    expect(email.text).toContain(`Manage your tokens: ${BASE}/explorer?settings=tokens`);
    expect(email.text).toContain('this is the only reminder we send for each one');
    expect(tokenExpiringEmail(BASE, '  ', Date.UTC(2026, 0, 5)).text).toMatch(
      /^One of your API tokens expires on January 5, 2026/,
    );
  });

  it('leaves out an owner without a verified address', async () => {
    addToken('bea', 'user_bea', NOW + DAY);
    expect(await sweepExpiringTokens(db, env, send, NOW)).toEqual({ sent: 0, failed: 0 });
    expect(warnedAt('bea')).toBeNull();
  });

  it('tries a failed send again on the next run', async () => {
    addToken('soon', 'user_ada', NOW + 3 * DAY);
    const down = async () => {
      throw new Error('Email Service refused the email');
    };
    expect(await sweepExpiringTokens(db, env, down, NOW)).toEqual({ sent: 0, failed: 1 });
    expect(warnedAt('soon')).toBeNull();
    expect(await sweepExpiringTokens(db, env, send, NOW + DAY)).toEqual({ sent: 1, failed: 0 });
    expect(warnedAt('soon')).toBe(NOW + DAY);
  });

  it('counts each warning under the owner’s sign-up app, and none for liveworkspace.app', async () => {
    addUser(sql, { id: 'user_cy', email: 'cy@example.com' });
    addUser(sql, { id: 'user_dee', email: 'dee@example.com' });
    await startLifecycle(db, { id: 'user_ada', email: 'ada@example.com' }, NOW, 'liveplanner.app');
    await startLifecycle(db, { id: 'user_cy', email: 'cy@example.com' }, NOW, 'liveworkspace.app');
    addToken('ada', 'user_ada', NOW + DAY);
    addToken('cy', 'user_cy', NOW + DAY);
    addToken('dee', 'user_dee', NOW + DAY);
    // A failed send isn't counted.
    addToken('ada-2', 'user_ada', NOW + 2 * DAY);
    await sweepExpiringTokens(
      db,
      env,
      async (email) => {
        if (sent.some((e) => e.to === email.to)) throw new Error('down');
        sent.push(email);
      },
      NOW,
    );
    expect(sent).toHaveLength(3);
    expect(waitingServerEvents()).toEqual([
      {
        app: 'liveplanner.app',
        event: { category: 'Email', action: 'Sent', type: 'TokenExpiring' },
      },
    ]);
  });

  it('is bounded: the soonest first, one read and one write however many are due', async () => {
    const owners = 60;
    for (let o = 0; o < owners; o++) {
      addUser(sql, { id: `user_${o}`, email: `p${o}@example.com` });
      for (let t = 0; t < 20; t++) {
        // Spread over the week, never two on the same millisecond.
        addToken(`t${o}-${t}`, `user_${o}`, NOW + 1 + (((o * 20 + t) * 7919) % (6 * DAY)));
      }
    }
    const statements: string[] = [];
    const counted = {
      ...db,
      prepare: (query: string) => {
        statements.push(query.trim().split(/\s+/)[0]!);
        return db.prepare(query);
      },
    } as D1Database;

    const started = performance.now();
    const result = await sweepExpiringTokens(counted, env, send, NOW);
    expect(performance.now() - started).toBeLessThan(1_000);

    expect(result).toEqual({ sent: TOKEN_EXPIRY_SWEEP_LIMIT, failed: 0 });
    expect(statements).toEqual(['SELECT', 'UPDATE']);
    const soonest = sql
      .prepare('SELECT id FROM api_token ORDER BY expiresAt LIMIT ?')
      .all(TOKEN_EXPIRY_SWEEP_LIMIT)
      .map((r) => (r as { id: string }).id);
    const warned = sql
      .prepare('SELECT id FROM api_token WHERE expiryWarnedAt IS NOT NULL ORDER BY expiresAt')
      .all()
      .map((r) => (r as { id: string }).id);
    expect(warned).toEqual(soonest);

    // The rest go on the following runs.
    await sweepExpiringTokens(db, env, send, NOW + 1);
    expect(sent).toHaveLength(2 * TOKEN_EXPIRY_SWEEP_LIMIT);
  });

  it('reads the list by its partial index', () => {
    const plan = sql
      .prepare(
        `EXPLAIN QUERY PLAN SELECT id FROM api_token
         WHERE revokedAt IS NULL AND expiryWarnedAt IS NULL AND expiresAt > 1 AND expiresAt <= 2
         ORDER BY expiresAt LIMIT 10`,
      )
      .all()
      .map((r) => (r as { detail: string }).detail)
      .join('\n');
    expect(plan).toContain('api_token_expiry_warning_idx');
  });

  it("waits for the owner's send window, London's when no zone is known", async () => {
    const HOUR = 60 * 60 * 1000;
    addUser(sql, { id: 'user_cy', email: 'cy@example.com' });
    sql.prepare('UPDATE "user" SET timeZone = ? WHERE id = ?').run('America/New_York', 'user_cy');
    addToken('ada', 'user_ada', NOW + 3 * DAY);
    addToken('cy', 'user_cy', NOW + 3 * DAY);
    const windowed = { ...env, EMAIL_SEND_WINDOW: undefined };
    // NOW is Friday 09:17 UTC: 10:17 in London (BST), 05:17 in New York (EDT).
    expect(await sweepExpiringTokens(db, windowed, send, NOW)).toEqual({ sent: 1, failed: 0 });
    expect(sent.map((e) => e.to)).toEqual(['ada@example.com']);
    expect(warnedAt('cy')).toBeNull();
    // 13:17 UTC is 09:17 in New York.
    expect(await sweepExpiringTokens(db, windowed, send, NOW + 4 * HOUR)).toEqual({
      sent: 1,
      failed: 0,
    });
    expect(sent.map((e) => e.to)).toEqual(['ada@example.com', 'cy@example.com']);
    // Nothing twice in the runs after.
    for (let at = NOW + 5 * HOUR; at < NOW + 2 * DAY; at += HOUR) {
      await sweepExpiringTokens(db, windowed, send, at);
    }
    expect(sent).toHaveLength(2);
  });

  it('sends nothing on a weekend, and the warning still comes days before the token lapses', async () => {
    const HOUR = 60 * 60 * 1000;
    const saturday = NOW + DAY; // Saturday 09:17 UTC
    // Within its week from Saturday morning: held to Monday, with five days left.
    addToken('weekend', 'user_ada', saturday + TOKEN_EXPIRY_WARNING_MS - HOUR);
    const windowed = { ...env, EMAIL_SEND_WINDOW: undefined };
    for (let at = saturday; at < saturday + 2 * DAY; at += HOUR) {
      await sweepExpiringTokens(db, windowed, send, at);
    }
    expect(sent).toEqual([]);
    await sweepExpiringTokens(db, windowed, send, saturday + 2 * DAY);
    expect(warnedAt('weekend')).toBe(saturday + 2 * DAY);
  });
});
