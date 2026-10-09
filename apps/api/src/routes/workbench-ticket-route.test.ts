import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORKBENCH_PAIRING_TTL_MS, WORKBENCH_TICKET_TTL_MS } from '@livediagram/api-schema';
import type { SqliteD1 } from '../test-sqlite-d1';
import type { Runtime } from '../types';
import type { WorkbenchContext } from './context';
import { makeTestRouteContext } from './test-route-context';
import { handleWorkbench } from './workbench';
import { NOW, ORIGIN, pairToken, rows, workbenchDb } from './workbench-test-fixtures';

type Opts = {
  token?: { id: string; readOnly?: boolean } | null;
  owner?: string | null;
  body?: unknown;
  rawBody?: string;
  workbench?: WorkbenchContext | null;
  env?: Runtime;
  headers?: Record<string, string>;
};

function mint(db: SqliteD1, opts: Opts = {}) {
  const token = opts.token === undefined ? { id: 'tok1' } : opts.token;
  return handleWorkbench(
    makeTestRouteContext('POST', '/api/workbench/tickets', {
      env: opts.env ?? db.env,
      owner: opts.owner === undefined ? 'user_1' : opts.owner,
      verifiedUserId: 'user_1',
      token,
      body:
        opts.rawBody === undefined
          ? (opts.body ?? { documentId: 'doc1', origin: ORIGIN })
          : undefined,
      rawBody: opts.rawBody,
      workbench: opts.workbench ?? null,
      headers: opts.headers,
    }),
  );
}

describe('POST /api/workbench/tickets', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('mints a ticket for a paired token and answers the frame URL', async () => {
    const db = await workbenchDb();
    pairToken(db);

    const res = await mint(db, { body: { documentId: 'doc1', tabId: 't1', origin: ORIGIN } });
    const body = (await res.json()) as { url: string };

    expect(res.status).toBe(201);
    expect(body).toEqual({
      url: expect.stringMatching(
        /^https:\/\/app\.test\/embed\/workbench\?d=doc1#ticket=[A-Za-z0-9_-]{22}$/,
      ),
      documentId: 'doc1',
      tabId: 't1',
      expiresAt: NOW + WORKBENCH_TICKET_TTL_MS,
    });
    expect(rows(db, 'SELECT role, pairing_id, origin, ticket_hash FROM workbench_tickets')).toEqual(
      [
        {
          role: 'edit',
          pairing_id: 'pair1',
          origin: ORIGIN,
          ticket_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        },
      ],
    );
    expect(console.log).toHaveBeenCalledWith('[workbench] ticket-minted', {
      documentId: 'doc1',
      tokenId: 'tok1',
      role: 'edit',
    });
  });

  it('answers tabId null when none was asked for', async () => {
    const db = await workbenchDb();
    pairToken(db);

    const body = (await (await mint(db)).json()) as { tabId: string | null };

    expect(body.tabId).toBeNull();
  });

  it('mints a view ticket for a read-only token', async () => {
    const db = await workbenchDb();
    pairToken(db, 'tok_ro', 'user_1', 'pair_ro');

    const res = await mint(db, { token: { id: 'tok_ro', readOnly: true } });

    expect(res.status).toBe(201);
    expect(rows(db, 'SELECT role FROM workbench_tickets')).toEqual([{ role: 'view' }]);
  });

  it('asks for pairing when the origin is not paired, reusing one request', async () => {
    const db = await workbenchDb();

    const first = await mint(db);
    const second = await mint(db);
    const a = (await first.json()) as { pairingUrl: string };
    const b = (await second.json()) as { pairingUrl: string };

    expect(first.status).toBe(428);
    expect(a).toEqual({
      error: 'pairing_required',
      pairingUrl: expect.stringMatching(
        /^https:\/\/app\.test\/workbench\/pair\?code=[A-Za-z0-9_-]{22}$/,
      ),
      expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
    });
    expect(b.pairingUrl).toBe(a.pairingUrl);
    expect(rows(db, 'SELECT name, status FROM workbench_pairing_requests')).toEqual([
      { name: null, status: 'pending' },
    ]);
    expect(rows(db, 'SELECT * FROM workbench_tickets')).toEqual([]);
  });

  it('requires a token: a Clerk session or a guest is refused', async () => {
    const db = await workbenchDb();
    pairToken(db);

    const res = await mint(db, { token: null });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'token_required' });
  });

  it.each([
    ['a missing document id', { origin: ORIGIN }, 'invalid documentId'],
    [
      'an overlong document id',
      { documentId: 'x'.repeat(65), origin: ORIGIN },
      'invalid documentId',
    ],
    ['a bad tab id', { documentId: 'doc1', tabId: 5, origin: ORIGIN }, 'invalid tabId'],
  ])('refuses %s', async (_why, body, message) => {
    const db = await workbenchDb();
    pairToken(db);

    const res = await mint(db, { body });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message });
  });

  it('refuses a body that is not JSON', async () => {
    const db = await workbenchDb();

    const res = await mint(db, { rawBody: 'nope' });

    expect(res.status).toBe(400);
  });

  it.each(['*', 'null', 'https://x.example/path', 'http://example.com', undefined])(
    'refuses the origin %s',
    async (origin) => {
      const db = await workbenchDb();
      pairToken(db);

      const res = await mint(db, { body: { documentId: 'doc1', origin } });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_origin' });
      expect(console.warn).toHaveBeenCalledWith('[workbench] mint-refused', {
        reason: 'invalid_origin',
        tokenId: 'tok1',
      });
    },
  );

  it('answers 404 for a document the owner cannot open, and for a tab it does not link', async () => {
    const db = await workbenchDb();
    pairToken(db);

    const foreign = await mint(db, { body: { documentId: 'doc2', origin: ORIGIN } });
    const missing = await mint(db, { body: { documentId: 'nope', origin: ORIGIN } });
    const tab = await mint(db, { body: { documentId: 'doc1', tabId: 'nope', origin: ORIGIN } });

    expect([foreign.status, missing.status, tab.status]).toEqual([404, 404, 404]);
  });

  it('answers 410 for the owner own trashed document', async () => {
    const db = await workbenchDb();
    pairToken(db);
    db.sql.exec(`UPDATE documents SET trashed_at = 1 WHERE id = 'doc1'`);

    const res = await mint(db);

    expect(res.status).toBe(410);
  });

  it('answers 404, not 410, for a trashed document the owner could never open', async () => {
    const db = await workbenchDb();
    pairToken(db);
    db.sql.exec(`UPDATE documents SET trashed_at = 1 WHERE id = 'doc2'`);

    const res = await mint(db, { body: { documentId: 'doc2', origin: ORIGIN } });

    expect(res.status).toBe(404);
  });

  it('ignores a share code: only the owner own access counts', async () => {
    const db = await workbenchDb();
    pairToken(db);
    db.sql.exec(`INSERT INTO share_links (code, document_id, role, created_at)
                 VALUES ('code1', 'doc2', 'edit', 1)`);

    const res = await mint(db, {
      body: { documentId: 'doc2', origin: ORIGIN },
      headers: { 'X-Share-Code': 'code1' },
    });

    expect(res.status).toBe(404);
  });

  it('is rate limited per token', async () => {
    const db = await workbenchDb();
    pairToken(db);
    const limit = vi.fn(async () => ({ success: false }));

    const res = await mint(db, {
      env: { ...db.env, limiters: { WORKBENCH_TICKET_RATE_LIMITER: { limit } } },
    });

    expect(res.status).toBe(429);
    expect(limit).toHaveBeenCalledWith({ key: 'workbench-ticket:tok1' });
  });
});
