import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isWorkbenchSessionFormat,
  WORKBENCH_SESSION_TTL_MS,
  WORKBENCH_TICKET_TTL_MS,
} from '@livediagram/api-schema';
import { hashWorkbenchSecret } from '../auth/workbench-session';
import type { SqliteD1 } from '../test-sqlite-d1';
import type { WorkbenchContext } from './context';
import { makeTestRouteContext } from './test-route-context';
import { handleWorkbench } from './workbench';
import { NOW, ORIGIN, pairToken, rows, workbenchDb } from './workbench-test-fixtures';

async function mintTicket(
  db: SqliteD1,
  token = { id: 'tok1' } as { id: string; readOnly?: boolean },
) {
  const res = await handleWorkbench(
    makeTestRouteContext('POST', '/api/workbench/tickets', {
      env: db.env,
      owner: 'user_1',
      verifiedUserId: 'user_1',
      token,
      body: { documentId: 'doc1', tabId: 't1', origin: ORIGIN },
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
  });

  it('opens a session as the person, with their display identity', async () => {
    const db = await workbenchDb();
    pairToken(db);
    db.sql.exec(`INSERT INTO participants (id, name, color, created_at, picture_url)
                 VALUES ('user_1', 'Webber', '#ff8800', 1, NULL)`);
    const ticket = await mintTicket(db);

    const res = await redeem(db, { ticket });
    const body = (await res.json()) as { session: string };

    expect(res.status).toBe(201);
    expect(body).toEqual({
      session: expect.any(String),
      documentId: 'doc1',
      tabId: 't1',
      origin: ORIGIN,
      role: 'edit',
      expiresAt: NOW + WORKBENCH_SESSION_TTL_MS,
      person: { id: 'user_1', name: 'Webber', color: '#ff8800', pictureUrl: null },
    });
    expect(isWorkbenchSessionFormat(body.session)).toBe(true);
    expect(rows(db, 'SELECT secret_hash, pairing_id FROM workbench_sessions')).toEqual([
      { secret_hash: await hashWorkbenchSecret(body.session), pairing_id: 'pair1' },
    ]);
    expect(console.log).toHaveBeenCalledWith('[workbench] session-opened', {
      documentId: 'doc1',
      tokenId: 'tok1',
      sessionPrefix: expect.stringMatching(/^[0-9a-f-]{8}$/),
      role: 'edit',
    });
  });

  it('answers a person without a profile with a null name and colour', async () => {
    const db = await workbenchDb();
    pairToken(db);
    const ticket = await mintTicket(db);

    const body = (await (await redeem(db, { ticket })).json()) as { person: unknown };

    expect(body.person).toEqual({ id: 'user_1', name: null, color: null, pictureUrl: null });
  });

  it('caps the session at the token expiry', async () => {
    const db = await workbenchDb();
    pairToken(db);
    db.sql.exec(`UPDATE api_tokens SET expires_at = ${NOW + 1000 * 60 * 5} WHERE id = 'tok1'`);
    const ticket = await mintTicket(db);

    const body = (await (await redeem(db, { ticket })).json()) as { expiresAt: number };

    expect(body.expiresAt).toBe(NOW + 1000 * 60 * 5);
  });

  it('opens a view session from a read-only token', async () => {
    const db = await workbenchDb();
    pairToken(db, 'tok_ro', 'user_1', 'pair_ro');
    const ticket = await mintTicket(db, { id: 'tok_ro', readOnly: true });

    const body = (await (await redeem(db, { ticket })).json()) as { role: string };

    expect(body.role).toBe('view');
  });

  it('opens one session per ticket', async () => {
    const db = await workbenchDb();
    pairToken(db);
    const ticket = await mintTicket(db);
    await redeem(db, { ticket });

    const again = await redeem(db, { ticket });

    expect(again.status).toBe(401);
    expect(await again.json()).toEqual({ error: 'invalid_ticket', reason: 'used' });
    expect(console.warn).toHaveBeenCalledWith('[workbench] session-refused', { reason: 'used' });
  });

  it('refuses an expired and an unknown ticket', async () => {
    const db = await workbenchDb();
    pairToken(db);
    const ticket = await mintTicket(db);
    vi.setSystemTime(NOW + WORKBENCH_TICKET_TTL_MS);

    const late = await redeem(db, { ticket });
    const unknown = await redeem(db, { ticket: 'A'.repeat(22) });

    expect(await late.json()).toEqual({ error: 'invalid_ticket', reason: 'expired' });
    expect(await unknown.json()).toEqual({ error: 'invalid_ticket', reason: 'unknown' });
  });

  it('refuses a ticket whose pairing was removed meanwhile', async () => {
    const db = await workbenchDb();
    pairToken(db);
    const ticket = await mintTicket(db);
    db.sql.exec(`DELETE FROM workbench_pairings WHERE id = 'pair1'`);

    const res = await redeem(db, { ticket });

    expect(await res.json()).toEqual({ error: 'invalid_ticket', reason: 'unknown' });
  });

  it('answers 404 when the owner lost access between mint and redemption', async () => {
    const db = await workbenchDb();
    pairToken(db);
    const ticket = await mintTicket(db);
    db.sql.exec(`UPDATE documents SET owner_id = 'user_2' WHERE id = 'doc1'`);

    const res = await redeem(db, { ticket });

    expect(res.status).toBe(404);
    expect(rows(db, 'SELECT * FROM workbench_sessions')).toEqual([]);
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
    const workbench = { sessionId: 's' } as WorkbenchContext;

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
    pairToken(db);
    db.sql.exec(`INSERT INTO workbench_sessions
                   (id, secret_hash, owner_id, token_id, pairing_id, document_id, tab_id, origin, role, created_at, expires_at)
                 VALUES ('sess1', 'h', 'user_1', 'tok1', 'pair1', 'doc1', NULL, '${ORIGIN}', 'edit', 1, ${NOW})`);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    const res = await handleWorkbench(
      makeTestRouteContext('DELETE', '/api/workbench/sessions/current', {
        env: db.env,
        workbench: { sessionId: 'sess1', documentId: 'doc1', tokenId: 'tok1' } as WorkbenchContext,
      }),
    );

    expect(res.status).toBe(204);
    expect(rows(db, 'SELECT * FROM workbench_sessions')).toEqual([]);
    expect(log).toHaveBeenCalledWith('[workbench] session-ended', {
      reason: 'ended',
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
        token: { id: 'tok1' },
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'not_a_workbench_session' });
  });
});
