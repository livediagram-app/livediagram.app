import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isWorkbenchSessionFormat,
  WORKBENCH_SESSION_TTL_MS,
  WORKBENCH_TICKET_TTL_MS,
} from '@livediagram/api-schema';
import { sha256Hex as hashWorkbenchSecret } from '@liveworkspace/index-app';
import type { SqliteD1 } from '../test-sqlite-d1';
import type { WorkbenchContext } from './context';
import { __resetProfileCache } from '../liveworkspace/profiles';
import { accountsServiceFor } from '../test-accounts-service';
import { makeTestRouteContext } from './test-route-context';
import { handleWorkbench } from './workbench';
import {
  arrangeFolders,
  NOW,
  ORIGIN,
  pairToken,
  rows,
  storeSql,
  tokenOf,
  USER_1_TEAMS,
  workbenchDb,
} from './workbench-test-fixtures';

vi.mock('../index-service', async (original) =>
  (await import('./workbench-test-fixtures')).indexServiceWithTestIndex(original as never),
);

const SESSION_CONTEXT: WorkbenchContext = {
  sessionId: 'sess1',
  ownerId: 'user_1',
  tokenId: 'tok1',
  pairingId: 'pair1',
  scope: 'document',
  documentId: 'doc1',
  folderId: null,
  tabId: null,
  origin: ORIGIN,
  level: 'edit',
  expiresAt: NOW,
};

async function mintTicket(
  db: SqliteD1,
  token = tokenOf('tok1'),
  body: Record<string, unknown> = { documentId: 'doc1', tabId: 't1', origin: ORIGIN },
) {
  const res = await handleWorkbench(
    makeTestRouteContext('POST', '/api/workbench/tickets', {
      env: db.env,
      owner: 'user_1',
      verifiedUserId: 'user_1',
      teams: USER_1_TEAMS,
      token,
      body,
    }),
  );
  const { url } = (await res.json()) as { url: string };
  return new URL(url).hash.replace('#ticket=', '');
}

const redeem = (db: SqliteD1, body: unknown) =>
  handleWorkbench(makeTestRouteContext('POST', '/api/workbench/sessions', { env: db.env, body }));

describe('POST /api/workbench/sessions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    __resetProfileCache();
  });

  it('opens a session as the person, with their display identity', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    const accounts = accountsServiceFor(db.env);
    accounts.profiles.set('user_1', { name: 'Webber', color: '#ff8800', createdAt: 1 });
    const ticket = await mintTicket(db);

    const res = await redeem(db, { ticket });
    const body = (await res.json()) as { session: string };

    expect(res.status).toBe(201);
    expect(body).toEqual({
      session: expect.any(String),
      scope: 'document',
      documentId: 'doc1',
      folderId: null,
      tabId: 't1',
      origin: ORIGIN,
      role: 'edit',
      expiresAt: NOW + WORKBENCH_SESSION_TTL_MS,
      person: { id: 'user_1', name: 'Webber', color: '#ff8800' },
    });
    expect(isWorkbenchSessionFormat(body.session)).toBe(true);
    expect(rows(db, 'SELECT secret_hash, pairing_id FROM wb_sessions')).toEqual([
      { secret_hash: await hashWorkbenchSecret(body.session), pairing_id: 'pair1' },
    ]);
    expect(console.log).toHaveBeenCalledWith('[workbench] session-opened', {
      scope: 'document',
      documentId: 'doc1',
      tokenId: 'tok1',
      sessionPrefix: expect.stringMatching(/^[0-9a-f-]{8}$/),
      role: 'edit',
    });
  });

  it('answers a person without a profile with a null name and colour', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    const ticket = await mintTicket(db);

    const body = (await (await redeem(db, { ticket })).json()) as { person: unknown };

    expect(body.person).toEqual({ id: 'user_1', name: null, color: null });
  });

  it('caps the session at the token expiry', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    const ticket = await mintTicket(db, { ...tokenOf('tok1'), expiresAt: NOW + 1000 * 60 * 5 });

    const body = (await (await redeem(db, { ticket })).json()) as { expiresAt: number };

    expect(body.expiresAt).toBe(NOW + 1000 * 60 * 5);
  });

  it('opens a view session from a read-only token', async () => {
    const db = await workbenchDb();
    await pairToken(db, 'tok_ro', 'user_1', 'pair_ro');
    const ticket = await mintTicket(db, tokenOf('tok_ro'));

    const body = (await (await redeem(db, { ticket })).json()) as { role: string };

    expect(body.role).toBe('view');
  });

  it('opens one session per ticket', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    const ticket = await mintTicket(db);
    await redeem(db, { ticket });

    const again = await redeem(db, { ticket });

    expect(again.status).toBe(401);
    expect(await again.json()).toEqual({ error: 'invalid_ticket', reason: 'used' });
    expect(console.warn).toHaveBeenCalledWith('[workbench] session-refused', {
      reason: 'used',
      scope: null,
    });
  });

  it('refuses an expired and an unknown ticket', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    const ticket = await mintTicket(db);
    vi.setSystemTime(NOW + WORKBENCH_TICKET_TTL_MS);

    const late = await redeem(db, { ticket });
    const unknown = await redeem(db, { ticket: `${'A'.repeat(22)}.${'0f'.repeat(32)}` });

    expect(await late.json()).toEqual({ error: 'invalid_ticket', reason: 'expired' });
    expect(await unknown.json()).toEqual({ error: 'invalid_ticket', reason: 'unknown' });
  });

  it('refuses a ticket whose pairing was removed meanwhile', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    const ticket = await mintTicket(db);
    storeSql(db).exec(`DELETE FROM wb_pairings WHERE id = 'pair1'`);

    const res = await redeem(db, { ticket });

    expect(await res.json()).toEqual({ error: 'invalid_ticket', reason: 'unknown' });
  });

  it('answers 404 when the owner lost access between mint and redemption', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    const ticket = await mintTicket(db);
    db.sql.exec(`UPDATE document SET owner_id = 'user_2' WHERE id = 'doc1'`);

    const res = await redeem(db, { ticket });

    expect(res.status).toBe(404);
    expect(rows(db, 'SELECT * FROM wb_sessions')).toEqual([]);
  });

  it.each([{}, { ticket: 'short' }, { ticket: 42 }])('refuses the body %j', async (body) => {
    const db = await workbenchDb();

    const res = await redeem(db, body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad_request', message: 'invalid ticket' });
  });

  it('refuses a body that is not JSON', async () => {
    const db = await workbenchDb();

    const res = await handleWorkbench(
      makeTestRouteContext('POST', '/api/workbench/sessions', { env: db.env, rawBody: 'nope' }),
    );

    expect(res.status).toBe(400);
  });

  it('refuses a workbench session redeeming another ticket', async () => {
    const db = await workbenchDb();
    const workbench = SESSION_CONTEXT;

    const res = await handleWorkbench(
      makeTestRouteContext('POST', '/api/workbench/sessions', {
        env: db.env,
        workbench,
        body: { ticket: 'A'.repeat(22) },
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'workbench_confined' });
  });
});

describe('DELETE /api/workbench/sessions/current', () => {
  afterEach(() => vi.restoreAllMocks());

  it('ends the presenting session', async () => {
    const db = await workbenchDb();
    await pairToken(db);
    storeSql(db).exec(`INSERT INTO wb_sessions
                   (id, secret_hash, token_id, pairing_id, scope, item_id, tab_id, origin, role, created_at, expires_at)
                 VALUES ('sess1', 'h', 'tok1', 'pair1', 'document', 'doc1', NULL, '${ORIGIN}', 'edit', 1, ${NOW})`);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await handleWorkbench(
      makeTestRouteContext('DELETE', '/api/workbench/sessions/current', {
        env: db.env,
        workbench: SESSION_CONTEXT,
      }),
    );

    expect(res.status).toBe(204);
    expect(rows(db, 'SELECT * FROM wb_sessions')).toEqual([]);
    expect(log).toHaveBeenCalledWith('[workbench] session-ended', {
      reason: 'ended',
      scope: 'document',
      documentId: 'doc1',
      tokenId: 'tok1',
      sessionPrefix: 'sess1',
    });
  });

  it('refuses a caller that is not a workbench session', async () => {
    const db = await workbenchDb();

    const res = await handleWorkbench(
      makeTestRouteContext('DELETE', '/api/workbench/sessions/current', {
        env: db.env,
        token: tokenOf('tok1'),
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not_a_workbench_session' });
  });
});

describe('POST /api/workbench/sessions, workspace scope', () => {
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

  it('opens a workspace session with no document, its folder and the ticket level', async () => {
    const db = await workbenchDb();
    await pairToken(db, 'tok1', 'user_1', 'pair1', 'workspace');
    arrangeFolders(db);
    const ticket = await mintTicket(db, tokenOf('tok1'), {
      scope: 'workspace',
      folderId: 'f-own',
      origin: ORIGIN,
    });

    const res = await redeem(db, { ticket });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      session: expect.any(String),
      scope: 'workspace',
      documentId: null,
      folderId: 'f-own',
      tabId: null,
      origin: ORIGIN,
      role: 'edit',
      expiresAt: NOW + WORKBENCH_SESSION_TTL_MS,
      person: { id: 'user_1', name: null, color: null },
    });
    expect(rows(db, 'SELECT scope, item_id, folder_id FROM wb_sessions')).toEqual([
      { scope: 'workspace', item_id: null, folder_id: 'f-own' },
    ]);
    expect(console.log).toHaveBeenCalledWith('[workbench] session-opened', {
      scope: 'workspace',
      documentId: null,
      tokenId: 'tok1',
      sessionPrefix: expect.any(String),
      role: 'edit',
    });
  });

  it('opens a view workspace session for a read-only token', async () => {
    const db = await workbenchDb();
    await pairToken(db, 'tok_ro', 'user_1', 'pair1', 'workspace');
    const ticket = await mintTicket(db, tokenOf('tok_ro'), {
      scope: 'workspace',
      origin: ORIGIN,
    });

    const res = await redeem(db, { ticket });

    expect((await res.json<{ role: string }>()).role).toBe('view');
  });
});
