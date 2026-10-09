import { describe, expect, it } from 'vitest';
import { WORKBENCH_PAIRING_TTL_MS, WORKBENCH_SESSION_GRACE_MS } from '@livediagram/api-schema';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import {
  answerPairingRequest,
  consumeWorkbenchTicket,
  deleteWorkbenchSession,
  findWorkbenchPairing,
  insertWorkbenchSession,
  insertWorkbenchTicket,
  listWorkbenchPairings,
  openPairingRequest,
  pairingRequestStatus,
  readPairingRequest,
  readWorkbenchSession,
  sweepWorkbench,
  type WorkbenchSessionRow,
  type WorkbenchTicketRow,
} from './workbench';

const NOW = 1_800_000_000_000;
const ORIGIN = 'https://127.0.0.1:5175';

function arrange(): SqliteD1 {
  const db = sqliteD1();
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('doc1', 'user_1', 'Home screen', 0, 1, 1)`);
  db.sql
    .exec(`INSERT INTO api_tokens (id, owner_id, token_hash, name, created_at, expires_at, revoked)
               VALUES ('tok1', 'user_1', 'h1', 'livediagram CLI', 1, ${NOW + 1e9}, 0),
                      ('tok2', 'user_2', 'h2', NULL, 1, ${NOW + 1e9}, 0)`);
  return db;
}

async function paired(db: SqliteD1): Promise<string> {
  await openPairingRequest(db.env, {
    ownerId: 'user_1',
    tokenId: 'tok1',
    origin: ORIGIN,
    name: 'Acme Editor',
    code: 'code_aaaaaaaaaaaaaaaaaa',
    now: NOW,
  });
  const answered = await answerPairingRequest(db.env, {
    code: 'code_aaaaaaaaaaaaaaaaaa',
    ownerId: 'user_1',
    answer: 'approve',
    pairingId: 'pair1',
    now: NOW,
  });
  if (answered.outcome !== 'approved') throw new Error('arrange: not approved');
  return answered.pairing.id;
}

const ticket = (over: Partial<WorkbenchTicketRow> = {}): WorkbenchTicketRow => ({
  ticketHash: 'th1',
  ownerId: 'user_1',
  tokenId: 'tok1',
  pairingId: 'pair1',
  documentId: 'doc1',
  tabId: null,
  origin: ORIGIN,
  role: 'edit',
  createdAt: NOW,
  expiresAt: NOW + 60_000,
  ...over,
});

const session = (over: Partial<WorkbenchSessionRow> = {}): WorkbenchSessionRow => ({
  id: 'sess-1',
  secretHash: 'sh1',
  ownerId: 'user_1',
  tokenId: 'tok1',
  pairingId: 'pair1',
  documentId: 'doc1',
  tabId: 't1',
  origin: ORIGIN,
  role: 'edit',
  createdAt: NOW,
  expiresAt: NOW + 3_600_000,
  ...over,
});

const count = (db: SqliteD1, table: string) =>
  (db.sql.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe('pairing requests', () => {
  it('opens one live request per token and origin, reusing it while it lives', async () => {
    const db = arrange();
    const input = { ownerId: 'user_1', tokenId: 'tok1', origin: ORIGIN, now: NOW };

    const first = await openPairingRequest(db.env, {
      ...input,
      name: null,
      code: 'code_aaaaaaaaaaaaaaaaaa',
    });
    const second = await openPairingRequest(db.env, {
      ...input,
      name: 'Acme Editor',
      code: 'code_bbbbbbbbbbbbbbbbbb',
    });

    expect(first).toEqual({
      code: 'code_aaaaaaaaaaaaaaaaaa',
      expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
      reused: false,
    });
    expect(second).toEqual({ ...first, reused: true });
    expect(count(db, 'workbench_pairing_requests')).toBe(1);
    expect((await readPairingRequest(db.env, 'code_aaaaaaaaaaaaaaaaaa', NOW))?.name).toBe(
      'Acme Editor',
    );
  });

  it('replaces a request that expired with a fresh code', async () => {
    const db = arrange();
    const input = { ownerId: 'user_1', tokenId: 'tok1', origin: ORIGIN, name: null };
    await openPairingRequest(db.env, { ...input, code: 'code_aaaaaaaaaaaaaaaaaa', now: NOW });

    const later = NOW + WORKBENCH_PAIRING_TTL_MS;
    const fresh = await openPairingRequest(db.env, {
      ...input,
      code: 'code_bbbbbbbbbbbbbbbbbb',
      now: later,
    });

    expect(fresh.code).toBe('code_bbbbbbbbbbbbbbbbbb');
    expect(fresh.reused).toBe(false);
    expect(count(db, 'workbench_pairing_requests')).toBe(1);
  });

  it('reads the page view with the token name, expired read as such', async () => {
    const db = arrange();
    await openPairingRequest(db.env, {
      ownerId: 'user_1',
      tokenId: 'tok1',
      origin: ORIGIN,
      name: 'Acme Editor',
      code: 'code_aaaaaaaaaaaaaaaaaa',
      now: NOW,
    });

    expect(await readPairingRequest(db.env, 'code_aaaaaaaaaaaaaaaaaa', NOW)).toEqual({
      ownerId: 'user_1',
      tokenId: 'tok1',
      origin: ORIGIN,
      name: 'Acme Editor',
      tokenName: 'livediagram CLI',
      expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
      status: 'pending',
    });
    const late = await readPairingRequest(
      db.env,
      'code_aaaaaaaaaaaaaaaaaa',
      NOW + WORKBENCH_PAIRING_TTL_MS,
    );
    expect(late?.status).toBe('expired');
    expect(await readPairingRequest(db.env, 'code_unknownnnnnnnnnnn', NOW)).toBeNull();
  });

  it('approves once: the pairing is recorded and a second answer is refused', async () => {
    const db = arrange();
    const pairingId = await paired(db);

    const again = await answerPairingRequest(db.env, {
      code: 'code_aaaaaaaaaaaaaaaaaa',
      ownerId: 'user_1',
      answer: 'decline',
      pairingId: 'pair2',
      now: NOW,
    });

    expect(pairingId).toBe('pair1');
    expect(await findWorkbenchPairing(db.env, 'tok1', ORIGIN)).toMatchObject({
      id: 'pair1',
      name: 'Acme Editor',
    });
    expect(again).toEqual({ outcome: 'answered' });
  });

  it('declines without recording a pairing', async () => {
    const db = arrange();
    await openPairingRequest(db.env, {
      ownerId: 'user_1',
      tokenId: 'tok1',
      origin: ORIGIN,
      name: null,
      code: 'code_aaaaaaaaaaaaaaaaaa',
      now: NOW,
    });

    const answered = await answerPairingRequest(db.env, {
      code: 'code_aaaaaaaaaaaaaaaaaa',
      ownerId: 'user_1',
      answer: 'decline',
      pairingId: 'pair1',
      now: NOW,
    });

    expect(answered).toEqual({ outcome: 'declined', tokenId: 'tok1' });
    expect(count(db, 'workbench_pairings')).toBe(0);
    expect(await pairingRequestStatus(db.env, 'code_aaaaaaaaaaaaaaaaaa', 'tok1', NOW)).toEqual({
      status: 'declined',
      expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
    });
  });

  it('refuses another account, an unknown code and an expired request', async () => {
    const db = arrange();
    await openPairingRequest(db.env, {
      ownerId: 'user_1',
      tokenId: 'tok1',
      origin: ORIGIN,
      name: null,
      code: 'code_aaaaaaaaaaaaaaaaaa',
      now: NOW,
    });
    const answer = (code: string, ownerId: string, now: number) =>
      answerPairingRequest(db.env, { code, ownerId, answer: 'approve', pairingId: 'p', now });

    expect(await answer('code_aaaaaaaaaaaaaaaaaa', 'user_2', NOW)).toEqual({ outcome: 'missing' });
    expect(await answer('code_unknownnnnnnnnnnn', 'user_1', NOW)).toEqual({ outcome: 'missing' });
    expect(
      await answer('code_aaaaaaaaaaaaaaaaaa', 'user_1', NOW + WORKBENCH_PAIRING_TTL_MS),
    ).toEqual({ outcome: 'expired' });
    expect(count(db, 'workbench_pairings')).toBe(0);
  });

  it('answers the status poll to the requesting token only', async () => {
    const db = arrange();
    await paired(db);

    expect(await pairingRequestStatus(db.env, 'code_aaaaaaaaaaaaaaaaaa', 'tok1', NOW)).toEqual({
      status: 'approved',
      expiresAt: NOW + WORKBENCH_PAIRING_TTL_MS,
    });
    expect(await pairingRequestStatus(db.env, 'code_aaaaaaaaaaaaaaaaaa', 'tok2', NOW)).toBeNull();
  });
});

// Another answer lands between the read and the flip: the env runs `sql` right after the request is read.
function raceAfterRead(db: SqliteD1, sql: string): SqliteD1 {
  const prepare = db.env.db.prepare.bind(db.env.db);
  const DB = {
    ...db.env.db,
    prepare: (query: string) => {
      const statement = prepare(query);
      if (!query.includes('JOIN api_tokens t ON t.id = r.token_id')) return statement;
      return {
        ...statement,
        bind: (...args: unknown[]) => {
          const bound = statement.bind(...args);
          return {
            ...bound,
            first: async <T>() => {
              const row = await bound.first<T>();
              db.sql.exec(sql);
              return row;
            },
          };
        },
      };
    },
  };
  return { ...db, env: { ...db.env, db: DB } as SqliteD1['env'] };
}

describe('racing answers', () => {
  async function pending(db: SqliteD1) {
    await openPairingRequest(db.env, {
      ownerId: 'user_1',
      tokenId: 'tok1',
      origin: ORIGIN,
      name: null,
      code: 'code_aaaaaaaaaaaaaaaaaa',
      now: NOW,
    });
  }
  const ANSWERED = `UPDATE workbench_pairing_requests SET status = 'declined', answered_at = 1`;

  it.each(['approve', 'decline'] as const)(
    'reads a %s that lost to a concurrent answer as answered, recording nothing',
    async (answer) => {
      const db = arrange();
      await pending(db);

      const result = await answerPairingRequest(raceAfterRead(db, ANSWERED).env, {
        code: 'code_aaaaaaaaaaaaaaaaaa',
        ownerId: 'user_1',
        answer,
        pairingId: 'pair1',
        now: NOW,
      });

      expect(result).toEqual({ outcome: 'answered' });
      expect(count(db, 'workbench_pairings')).toBe(0);
    },
  );

  it('refuses to report a pairing nobody can find after approval', async () => {
    const db = arrange();
    await pending(db);
    const batch = db.env.db.batch.bind(db.env.db);
    const env = {
      ...db.env,
      db: {
        ...db.env.db,
        batch: async (statements: Parameters<typeof batch>[0]) => {
          const results = await batch(statements);
          db.sql.exec('DELETE FROM workbench_pairings');
          return results;
        },
      },
    } as SqliteD1['env'];

    await expect(
      answerPairingRequest(env, {
        code: 'code_aaaaaaaaaaaaaaaaaa',
        ownerId: 'user_1',
        answer: 'approve',
        pairingId: 'pair1',
        now: NOW,
      }),
    ).rejects.toThrow('approved request recorded no pairing');
  });

  it('refuses a code that collides with another request', async () => {
    const db = arrange();
    await pending(db);

    await expect(
      openPairingRequest(db.env, {
        ownerId: 'user_2',
        tokenId: 'tok2',
        origin: ORIGIN,
        name: null,
        code: 'code_aaaaaaaaaaaaaaaaaa',
        now: NOW,
      }),
    ).rejects.toThrow('no live pairing request after a refused insert');
  });
});

describe('pairings', () => {
  it('lists the owner pairings of live tokens only, newest first', async () => {
    const db = arrange();
    await paired(db);
    db.sql.exec(`INSERT INTO workbench_pairings (id, owner_id, token_id, origin, name, created_at)
                 VALUES ('pair0', 'user_1', 'tok1', 'https://old.example', NULL, ${NOW - 10})`);

    expect(await listWorkbenchPairings(db.env, 'user_1', NOW)).toEqual([
      { id: 'pair1', tokenId: 'tok1', origin: ORIGIN, name: 'Acme Editor', pairedAt: NOW },
      {
        id: 'pair0',
        tokenId: 'tok1',
        origin: 'https://old.example',
        name: null,
        pairedAt: NOW - 10,
      },
    ]);
    db.sql.exec(`UPDATE api_tokens SET revoked = 1 WHERE id = 'tok1'`);
    expect(await listWorkbenchPairings(db.env, 'user_1', NOW)).toEqual([]);
    expect(await listWorkbenchPairings(db.env, 'user_2', NOW)).toEqual([]);
  });
});

describe('tickets', () => {
  it('consumes a ticket once', async () => {
    const db = arrange();
    await paired(db);
    await insertWorkbenchTicket(db.env, ticket());

    const first = await consumeWorkbenchTicket(db.env, 'th1', NOW);
    const second = await consumeWorkbenchTicket(db.env, 'th1', NOW);

    expect(first).toEqual({
      ok: true,
      ticket: {
        ownerId: 'user_1',
        tokenId: 'tok1',
        pairingId: 'pair1',
        documentId: 'doc1',
        tabId: null,
        origin: ORIGIN,
        role: 'edit',
        tokenExpiresAt: NOW + 1e9,
        tokenReadOnly: false,
      },
    });
    expect(second).toEqual({ ok: false, reason: 'used' });
  });

  it('classifies an expired and an unknown ticket', async () => {
    const db = arrange();
    await paired(db);
    await insertWorkbenchTicket(db.env, ticket());

    expect(await consumeWorkbenchTicket(db.env, 'th1', NOW + 60_000)).toEqual({
      ok: false,
      reason: 'expired',
    });
    expect(await consumeWorkbenchTicket(db.env, 'nope', NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('refuses a ticket whose token was revoked as unknown', async () => {
    const db = arrange();
    await paired(db);
    await insertWorkbenchTicket(db.env, ticket());
    db.sql.exec(`UPDATE api_tokens SET revoked = 1 WHERE id = 'tok1'`);

    expect(await consumeWorkbenchTicket(db.env, 'th1', NOW)).toEqual({
      ok: false,
      reason: 'unknown',
    });
  });

  it('goes with its pairing', async () => {
    const db = arrange();
    await paired(db);
    await insertWorkbenchTicket(db.env, ticket());
    await insertWorkbenchSession(db.env, session());

    db.sql.exec(`DELETE FROM workbench_pairings WHERE id = 'pair1'`);
    expect(count(db, 'workbench_tickets')).toBe(0);
    expect(count(db, 'workbench_sessions')).toBe(0);
  });

  it('goes with a purged document', async () => {
    const db = arrange();
    await paired(db);
    await insertWorkbenchTicket(db.env, ticket());
    await insertWorkbenchSession(db.env, session());

    db.sql.exec(`DELETE FROM documents WHERE id = 'doc1'`);

    expect(count(db, 'workbench_tickets')).toBe(0);
    expect(count(db, 'workbench_sessions')).toBe(0);
    expect(count(db, 'workbench_pairings')).toBe(1);
  });
});

describe('sessions', () => {
  it('reads a live session with its token state', async () => {
    const db = arrange();
    await paired(db);
    await insertWorkbenchSession(db.env, session());

    expect(await readWorkbenchSession(db.env, 'sh1')).toEqual({
      ...session(),
      tokenRevoked: false,
      tokenReadOnly: false,
      tokenExpiresAt: NOW + 1e9,
    });
    expect(await readWorkbenchSession(db.env, 'nope')).toBeNull();
  });

  it('deletes one session by id', async () => {
    const db = arrange();
    await paired(db);
    await insertWorkbenchSession(db.env, session());

    await deleteWorkbenchSession(db.env, 'sess-1');

    expect(await readWorkbenchSession(db.env, 'sh1')).toBeNull();
  });
});

describe('sweepWorkbench', () => {
  it('deletes what is due and nothing else', async () => {
    const db = arrange();
    await paired(db);
    // Due: a spent ticket, a request past expiry, a session past its grace, a pairing of a revoked token.
    await insertWorkbenchTicket(db.env, ticket({ ticketHash: 'old', expiresAt: NOW - 1 }));
    await insertWorkbenchTicket(db.env, ticket({ ticketHash: 'live', expiresAt: NOW + 1 }));
    await insertWorkbenchSession(
      db.env,
      session({ id: 'gone', secretHash: 'g', expiresAt: NOW - WORKBENCH_SESSION_GRACE_MS - 1 }),
    );
    await insertWorkbenchSession(
      db.env,
      session({ id: 'grace', secretHash: 'r', expiresAt: NOW - 1 }),
    );
    await openPairingRequest(db.env, {
      ownerId: 'user_2',
      tokenId: 'tok2',
      origin: ORIGIN,
      name: null,
      code: 'code_cccccccccccccccccc',
      now: NOW - WORKBENCH_PAIRING_TTL_MS - 1,
    });
    db.sql.exec(`INSERT INTO workbench_pairings (id, owner_id, token_id, origin, name, created_at)
                 VALUES ('pair2', 'user_2', 'tok2', '${ORIGIN}', NULL, ${NOW})`);
    db.sql.exec(`UPDATE api_tokens SET revoked = 1 WHERE id = 'tok2'`);

    const deleted = await sweepWorkbench(db.env, NOW);

    expect(deleted).toBe(4);
    expect(count(db, 'workbench_tickets')).toBe(1);
    expect(count(db, 'workbench_sessions')).toBe(1);
    expect(count(db, 'workbench_pairings')).toBe(1);
  });
});
