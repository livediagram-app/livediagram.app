import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_POLL_INTERVAL_S, WORKBENCH_PAIRING_TTL_MS } from '@livediagram/api-schema';
import type { SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { makeTestRouteContext } from './test-route-context';
import { handleWorkbench } from './workbench';
import { NOW, ORIGIN, pairToken, rows, workbenchDb } from './workbench-test-fixtures';

type Caller =
  | { kind: 'token'; tokenId: string; owner?: string }
  | { kind: 'clerk'; userId: string }
  | { kind: 'none' };

function call(
  db: SqliteD1,
  method: string,
  path: string,
  caller: Caller,
  body?: unknown,
  env?: Env,
) {
  const identity =
    caller.kind === 'token'
      ? {
          owner: caller.owner ?? 'user_1',
          verifiedUserId: caller.owner ?? 'user_1',
          token: { id: caller.tokenId },
        }
      : caller.kind === 'clerk'
        ? { owner: caller.userId, clerkUserId: caller.userId }
        : {};
  return handleWorkbench(
    makeTestRouteContext(method, `/api/workbench/${path}`, {
      env: env ?? db.env,
      body,
      ...identity,
    }),
  );
}

const TOKEN: Caller = { kind: 'token', tokenId: 'tok1' };
const OWNER: Caller = { kind: 'clerk', userId: 'user_1' };

async function ask(db: SqliteD1, name?: string) {
  const res = await call(db, 'POST', 'pairing-requests', TOKEN, { origin: ORIGIN, name });
  return (await res.json()) as { code: string; pairingUrl: string };
}

describe('workbench pairing routes', () => {
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

  describe('POST pairing-requests', () => {
    it('opens a request with a name and a poll interval', async () => {
      const db = await workbenchDb();

      const res = await call(db, 'POST', 'pairing-requests', TOKEN, {
        origin: ORIGIN,
        name: ' Acme Editor ',
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        status: 'pending',
        pairingUrl: expect.stringMatching(/^https:\/\/app\.test\/workbench\/pair\?code=/),
        code: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
        expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
        interval: DEVICE_POLL_INTERVAL_S,
      });
      expect(rows(db, 'SELECT name FROM workbench_pairing_requests')).toEqual([
        { name: 'Acme Editor' },
      ]);
    });

    it('reuses the request a mint opened, taking the name', async () => {
      const db = await workbenchDb();
      await call(db, 'POST', 'tickets', TOKEN, { documentId: 'doc1', origin: ORIGIN });

      const pending = await ask(db, 'Acme Editor');

      expect(rows(db, 'SELECT code, name FROM workbench_pairing_requests')).toEqual([
        { code: pending.code, name: 'Acme Editor' },
      ]);
    });

    it('answers paired when the pairing exists', async () => {
      const db = await workbenchDb();
      pairToken(db);

      const res = await call(db, 'POST', 'pairing-requests', TOKEN, { origin: ORIGIN });

      expect(await res.json()).toEqual({
        status: 'paired',
        pairing: {
          id: 'pair1',
          tokenId: 'tok1',
          origin: ORIGIN,
          name: 'Acme Editor',
          pairedAt: NOW,
        },
      });
    });

    it('refuses a non-token caller, a bad origin and an over-limit token', async () => {
      const db = await workbenchDb();
      const limit = vi.fn(async () => ({ success: false }));

      const clerk = await call(db, 'POST', 'pairing-requests', OWNER, { origin: ORIGIN });
      const origin = await call(db, 'POST', 'pairing-requests', TOKEN, { origin: '*' });
      const limited = await call(
        db,
        'POST',
        'pairing-requests',
        TOKEN,
        { origin: ORIGIN },
        {
          ...db.env,
          WORKBENCH_TICKET_RATE_LIMITER: { limit },
        },
      );

      const notJson = await handleWorkbench(
        makeTestRouteContext('POST', '/api/workbench/pairing-requests', {
          env: db.env,
          owner: 'user_1',
          token: { id: 'tok1' },
          rawBody: 'nope',
        }),
      );
      const noOrigin = await call(db, 'POST', 'pairing-requests', TOKEN, {});

      expect([clerk.status, origin.status, limited.status]).toEqual([403, 400, 429]);
      expect([notJson.status, noOrigin.status]).toEqual([400, 400]);
      expect(await clerk.json()).toEqual({ error: 'token_required' });
      expect(await origin.json()).toEqual({ error: 'invalid_origin' });
    });
  });

  describe('the pairing page', () => {
    it('reads the request for its owner only', async () => {
      const db = await workbenchDb();
      const { code } = await ask(db, 'Acme Editor');

      const mine = await call(db, 'GET', `pairing-requests/${code}`, OWNER);
      const theirs = await call(db, 'GET', `pairing-requests/${code}`, {
        kind: 'clerk',
        userId: 'user_2',
      });
      const token = await call(db, 'GET', `pairing-requests/${code}`, TOKEN);
      const bad = await call(db, 'GET', 'pairing-requests/short', OWNER); // no such request

      expect(await mine.json()).toEqual({
        request: {
          origin: ORIGIN,
          name: 'Acme Editor',
          tokenName: 'livediagram CLI',
          expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
          status: 'pending',
        },
      });
      expect([theirs.status, token.status, bad.status]).toEqual([404, 401, 404]);
      expect(await token.json()).toEqual({ error: 'sign_in_required' });
    });

    it('approves: the pairing is recorded and the poll reads approved', async () => {
      const db = await workbenchDb();
      const { code } = await ask(db, 'Acme Editor');

      const res = await call(db, 'POST', `pairing-requests/${code}/approve`, OWNER);
      const poll = await call(db, 'GET', `pairing-requests/${code}/status`, TOKEN);

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        pairing: {
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          tokenId: 'tok1',
          origin: ORIGIN,
          name: 'Acme Editor',
          pairedAt: NOW,
        },
      });
      expect(await poll.json()).toEqual({
        status: 'approved',
        expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
        interval: DEVICE_POLL_INTERVAL_S,
      });
      expect(console.log).toHaveBeenCalledWith('[workbench] paired', {
        tokenId: 'tok1',
        pairingId: expect.any(String),
      });
    });

    it('declines, and refuses a second answer and an expired one', async () => {
      const db = await workbenchDb();
      const { code } = await ask(db);

      const declined = await call(db, 'POST', `pairing-requests/${code}/decline`, OWNER);
      const again = await call(db, 'POST', `pairing-requests/${code}/approve`, OWNER);
      const fresh = await ask(db);
      vi.setSystemTime(NOW + WORKBENCH_PAIRING_TTL_MS);
      const late = await call(db, 'POST', `pairing-requests/${fresh.code}/approve`, OWNER);

      expect(declined.status).toBe(204);
      expect(again.status).toBe(409);
      expect(await again.json()).toEqual({ error: 'pairing_answered' });
      expect(late.status).toBe(410);
      expect(await late.json()).toEqual({ error: 'pairing_expired' });
      expect(rows(db, 'SELECT * FROM workbench_pairings')).toEqual([]);
      expect(console.log).toHaveBeenCalledWith('[workbench] pairing-declined', { tokenId: 'tok1' });
    });

    it('refuses a token approving its own request, and another account', async () => {
      const db = await workbenchDb();
      const { code } = await ask(db);

      const token = await call(db, 'POST', `pairing-requests/${code}/approve`, TOKEN);
      const other = await call(db, 'POST', `pairing-requests/${code}/approve`, {
        kind: 'clerk',
        userId: 'user_2',
      });

      expect(token.status).toBe(401);
      expect(other.status).toBe(404);
    });
  });

  describe('the status poll', () => {
    it('answers the requesting token only', async () => {
      const db = await workbenchDb();
      const { code } = await ask(db);

      const other = await call(db, 'GET', `pairing-requests/${code}/status`, {
        kind: 'token',
        tokenId: 'tok2',
        owner: 'user_2',
      });
      const clerk = await call(db, 'GET', `pairing-requests/${code}/status`, OWNER);

      expect(other.status).toBe(404);
      expect(clerk.status).toBe(403);
    });
  });

  describe('pairings', () => {
    it('lists the signed-in person pairings', async () => {
      const db = await workbenchDb();
      pairToken(db);

      const res = await call(db, 'GET', 'pairings', OWNER);
      const token = await call(db, 'GET', 'pairings', TOKEN);

      expect(await res.json()).toEqual({
        pairings: [
          { id: 'pair1', tokenId: 'tok1', origin: ORIGIN, name: 'Acme Editor', pairedAt: NOW },
        ],
      });
      expect(token.status).toBe(401);
    });

    it('unpairs for the owner only', async () => {
      const db = await workbenchDb();
      pairToken(db);

      const other = await call(db, 'DELETE', 'pairings/pair1', { kind: 'clerk', userId: 'user_2' });
      const mine = await call(db, 'DELETE', 'pairings/pair1', OWNER);
      const gone = await call(db, 'DELETE', 'pairings/pair1', OWNER);

      const token = await call(db, 'DELETE', 'pairings/pair1', TOKEN);

      expect([other.status, mine.status, gone.status, token.status]).toEqual([404, 204, 404, 401]);
      expect(rows(db, 'SELECT * FROM workbench_pairings')).toEqual([]);
    });
  });

  it('answers 404 for an unknown path', async () => {
    const db = await workbenchDb();

    expect((await call(db, 'GET', 'nope', OWNER)).status).toBe(404);
  });

  it.each([
    ['GET', 'tickets'],
    ['GET', 'sessions'],
    ['GET', 'sessions/current'],
    ['GET', 'pairing-requests'],
    ['POST', 'pairing-requests/code_aaaaaaaaaaaaaaaaaa'],
    ['POST', 'pairing-requests/code_aaaaaaaaaaaaaaaaaa/status'],
    ['GET', 'pairing-requests/code_aaaaaaaaaaaaaaaaaa/approve'],
    ['GET', 'pairing-requests/code_aaaaaaaaaaaaaaaaaa/decline'],
    ['PUT', 'pairings'],
    ['GET', 'pairings/pair1'],
  ])('answers 405 to %s %s', async (method, path) => {
    const db = await workbenchDb();

    expect((await call(db, method, path, OWNER)).status).toBe(405);
  });
});
