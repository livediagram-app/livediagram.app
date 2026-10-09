import type { DbStatement } from '@livediagram/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Element } from '@livediagram/document';
import { getDocument } from '../db';
import { seedTabs } from '../db/tabs';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Runtime } from '../types';
import { parseChangesetRequest } from './request';
import { submitChangeset } from './submit';

// The pipeline's attempt loop and relay (docs/specs/024-agents/blueprints/agent-changesets.md "The
// pipeline" steps 9 and 10), on real SQLite with an injected interleaving.

const box = (id: string, label = id): Element =>
  ({ id, type: 'shape', shape: 'square', x: 0, y: 0, width: 120, height: 60, label }) as Element;

function roomThat(relay: 'ok' | 'throws') {
  return {
    for: () => ({
      fetch: async (url: string) => {
        if (url.includes('/selections')) return Response.json({ selections: [] });
        if (relay === 'throws') throw new Error('room gone');
        return new Response(null, { status: 204 });
      },
    }),
  };
}

async function setUp(relay: 'ok' | 'throws' = 'ok'): Promise<SqliteD1> {
  const db = sqliteD1({ rooms: roomThat(relay) } as unknown as Partial<Runtime>);
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('D', 'user_o', 'Doc', 0, 1, 1)`);
  await seedTabs(db.env, 'D', [{ id: 't1', name: 'T', elements: [box('a'), box('b')] }]);
  return db;
}

async function submit(db: SqliteD1, operations: unknown[]) {
  const parsed = parseChangesetRequest({ operations });
  if (!parsed.ok) throw new Error('bad request');
  return submitChangeset({
    env: db.env,
    document: (await getDocument(db.env, 'D'))!,
    tabId: 't1',
    request: parsed.value,
    dryRun: false,
    author: { id: 'user_o', name: 'W', color: '#000' },
    tokenId: 'tok_1',
    frontDoor: 'Api',
  });
}

const labels = (db: SqliteD1) =>
  (
    JSON.parse(db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!.data as string)
      .elements as Element[]
  ).map((e) => [e.id, (e as { label?: string }).label]);

// Every batch the pipeline sends meets a person's save first, `times` times.
function interleave(db: SqliteD1, times: number) {
  const batch = db.env.db.batch.bind(db.env.db);
  let left = times;
  db.env.db.batch = (async (statements: DbStatement[]) => {
    if (left > 0) {
      left -= 1;
      const row = db.sql.prepare("SELECT data FROM tabs WHERE id = 't1'").get()!;
      const data = JSON.parse(row.data as string) as { elements: Element[] };
      data.elements = data.elements.map((e) => (e.id === 'b' ? box('b', `person ${left}`) : e));
      db.sql
        .prepare("UPDATE tabs SET data = ?, rev = rev + 1 WHERE id = 't1'")
        .run(JSON.stringify(data));
    }
    return batch(statements);
  }) as typeof db.env.db.batch;
}

afterEach(() => vi.restoreAllMocks());

describe('submitChangeset', () => {
  it('repeats a lost race once, compiling on the winner, keeping its write', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await setUp();
    interleave(db, 1);
    const res = await submit(db, [{ op: 'set', target: 'a', fields: { label: 'agent' } }]);
    expect(res.status).toBe(200);
    expect(labels(db)).toEqual([
      ['a', 'agent'],
      ['b', 'person 0'],
    ]);
    expect(warn).toHaveBeenCalledWith(
      '[changeset] lost-race',
      expect.objectContaining({ attempt: 1 }),
    );
  });

  it('answers tab_busy after a second lost race, writing nothing of its own', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await setUp();
    interleave(db, 2);
    const res = await submit(db, [{ op: 'set', target: 'a', fields: { label: 'agent' } }]);
    expect(res).toMatchObject({ status: 409, body: { error: 'tab_busy' } });
    expect(labels(db)[0]).toEqual(['a', 'a']);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM agent_changesets').get()!.n).toBe(0);
  });

  it('answers 200 when the relay throws: D1 holds the changeset, and the warning says so', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const db = await setUp('throws');
    const res = await submit(db, [{ op: 'rm', target: 'b' }]);
    expect(res.status).toBe(200);
    expect(db.sql.prepare('SELECT COUNT(*) AS n FROM agent_changesets').get()!.n).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      '[changeset] relay-failed',
      expect.objectContaining({ documentId: 'D' }),
    );
  });
});
