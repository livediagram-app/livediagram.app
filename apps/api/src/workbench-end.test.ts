import { afterEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from './test-sqlite-d1';
import type { Runtime } from './types';
import { endWorkbenchAccess } from './workbench-end';

const NOW = 1_800_000_000_000;
const P1 = '3f1c9a2e-7b4d-4c8e-9a1f-2b3c4d5e6f70';
const P2 = '00000000-0000-4000-8000-000000000002';

// Two pairings of tok1 (sessions on doc1 and doc2), one of tok2 (a session on doc1), and pending requests.
function arrange(roomOk = true): {
  db: SqliteD1;
  env: Runtime;
  closes: { doc: string; body: unknown }[];
} {
  const closes: { doc: string; body: unknown }[] = [];
  const db = sqliteD1();
  const env = {
    ...db.env,
    rooms: {
      for: (doc: string) => ({
        fetch: async (_url: string, init: RequestInit) => {
          closes.push({ doc, body: JSON.parse(String(init.body)) });
          return new Response(null, { status: roomOk ? 204 : 500 });
        },
      }),
    },
  } as unknown as Runtime;
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('doc1', 'u1', 'A', 0, 1, 1), ('doc2', 'u1', 'B', 0, 1, 1)`);
  db.sql
    .exec(`INSERT INTO api_tokens (id, owner_id, token_hash, name, created_at, expires_at, revoked)
               VALUES ('tok1', 'u1', 'h1', NULL, 1, ${NOW * 2}, 0), ('tok2', 'u1', 'h2', NULL, 1, ${NOW * 2}, 0)`);
  db.sql.exec(`INSERT INTO workbench_pairings (id, owner_id, token_id, origin, name, created_at)
               VALUES ('${P1}', 'u1', 'tok1', 'https://a.example', NULL, 1),
                      ('${P2}', 'u1', 'tok1', 'https://b.example', NULL, 1),
                      ('p3', 'u1', 'tok2', 'https://a.example', NULL, 1)`);
  const session = (id: string, pairing: string, doc: string, token = 'tok1') =>
    `('${id}', 'h${id}', 'u1', '${token}', '${pairing}', '${doc}', NULL, 'https://a.example', 'edit', 1, ${NOW})`;
  db.sql.exec(`INSERT INTO workbench_sessions
                 (id, secret_hash, owner_id, token_id, pairing_id, document_id, tab_id, origin, role, created_at, expires_at)
               VALUES ${session('s1aaaaaaaa', P1, 'doc1')}, ${session('s2bbbbbbbb', P1, 'doc2')},
                      ${session('s3cccccccc', P2, 'doc1')}, ${session('s4dddddddd', 'p3', 'doc1', 'tok2')}`);
  db.sql
    .exec(`INSERT INTO workbench_pairing_requests (id, code, owner_id, token_id, origin, status, created_at, expires_at)
               VALUES ('r1', 'c1', 'u1', 'tok1', 'https://c.example', 'pending', 1, ${NOW * 2}),
                      ('r2', 'c2', 'u1', 'tok2', 'https://c.example', 'pending', 1, ${NOW * 2})`);
  return { db, env, closes };
}

const ids = (db: SqliteD1, table: string) =>
  (db.sql.prepare(`SELECT id FROM ${table} ORDER BY id`).all() as { id: string }[]).map(
    (r) => r.id,
  );

describe('endWorkbenchAccess', () => {
  afterEach(() => vi.restoreAllMocks());

  it('unpairs one pairing: its rows go and its rooms close with its sockets only', async () => {
    const { db, env, closes } = arrange();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await endWorkbenchAccess(env, { pairingId: P1 }, 'unpaired');

    expect(ids(db, 'workbench_pairings')).toEqual([P2, 'p3'].sort());
    expect(ids(db, 'workbench_sessions')).toEqual(['s3cccccccc', 's4dddddddd']);
    expect(ids(db, 'workbench_pairing_requests')).toEqual(['r1', 'r2']);
    expect(closes.sort((a, b) => a.doc.localeCompare(b.doc))).toEqual([
      { doc: 'doc1', body: { match: 'workbench', pairingId: P1 } },
      { doc: 'doc2', body: { match: 'workbench', pairingId: P1 } },
    ]);
    expect(log).toHaveBeenCalledWith('[workbench] session-ended', {
      reason: 'unpaired',
      documentId: 'doc1',
      tokenId: 'tok1',
      sessionPrefix: 's1aaaaaa',
    });
    expect(log).toHaveBeenCalledWith('[workbench] unpaired', {
      tokenId: 'tok1',
      pairingId: P1,
      reason: 'unpaired',
      rooms: 2,
      unreached: 0,
    });
  });

  it('ends a revoked token: its pairings, requests and sessions, and nobody else', async () => {
    const { db, env, closes } = arrange();
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await endWorkbenchAccess(env, { tokenId: 'tok1' }, 'revoked');

    expect(ids(db, 'workbench_pairings')).toEqual(['p3']);
    expect(ids(db, 'workbench_sessions')).toEqual(['s4dddddddd']);
    expect(ids(db, 'workbench_pairing_requests')).toEqual(['r2']);
    expect(closes).toHaveLength(3);
  });

  it('keeps the deletion when a room cannot be reached, counting it', async () => {
    const { db, env } = arrange(false);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await endWorkbenchAccess(env, { pairingId: P1 }, 'unpaired');

    expect(ids(db, 'workbench_sessions')).not.toContain('s1aaaaaaaa');
    expect(log).toHaveBeenCalledWith(
      '[workbench] unpaired',
      expect.objectContaining({ rooms: 2, unreached: 2 }),
    );
  });

  it('does nothing for a scope with no pairing', async () => {
    const { env, closes } = arrange();

    await endWorkbenchAccess(env, { pairingId: 'nope' }, 'unpaired');

    expect(closes).toEqual([]);
  });
});
