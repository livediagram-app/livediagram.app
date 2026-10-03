import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { getScopeState } from '../db/timeline';
import { nextFrecencyKey, frecencyScore } from '@livediagram/api-schema';
import { recordDocumentOpen } from './record-open';
import { FRECENCY_SEED_DOCUMENT_MAX, seedFrecency } from './seed-frecency';

// Seeding Jump back in once from a person's real edit days
// (docs/specs/013-workspace/explorer-home.md "Jump back in"; blueprint "Seeding frecency").

const DAY = 24 * 60 * 60 * 1000;
// 2023-11-14 22:13:20 UTC.
const NOW = 1_700_000_000_000;
let db: SqliteD1;
let logs: string[];
let seq = 0;

function addDoc(id: string) {
  db.sql
    .prepare(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
       VALUES (?, 'me', ?, 0, 1, 1)`,
    )
    .run(id, id);
}

function edit(doc: string, at: number, opts: { actor?: string; backfilled?: boolean } = {}) {
  seq += 1;
  db.sql
    .prepare(
      `INSERT INTO timeline_events (id, actor_id, source_type, source_id, event_type, dedupe_key, title,
         occurred_at, snapshot, created_at)
       VALUES (?, ?, 'document', ?, 'document_edited', ?, 'Document Updated', ?, ?, ?)`,
    )
    .run(
      `e${seq}`,
      opts.actor ?? 'me',
      doc,
      `k${seq}`,
      at,
      JSON.stringify({ documentId: doc, ...(opts.backfilled ? { backfilled: true } : {}) }),
      at,
    );
}

function row(doc: string) {
  return db.sql
    .prepare("SELECT * FROM document_opens WHERE owner_id = 'me' AND document_id = ?")
    .get(doc) as
    | {
        open_days: number;
        first_opened_at: number;
        last_opened_at: number;
        last_open_day: string;
        frecency_key: number;
      }
    | undefined;
}

beforeEach(() => {
  db = sqliteD1();
  seq = 0;
  logs = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
  for (const id of ['d1', 'd2', 'd3']) addDoc(id);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('seedFrecency', () => {
  it('counts each day the person really edited a document as a day they opened it', async () => {
    edit('d1', NOW - 3 * DAY);
    edit('d1', NOW - DAY);
    edit('d2', NOW - 2 * DAY, { backfilled: true });
    edit('d3', NOW - DAY, { actor: 'priya' });
    edit('gone', NOW - DAY);

    expect(await seedFrecency(db.env, 'me', NOW)).toEqual({
      docs: 1,
      days: 2,
      conflicts: 0,
      capped: false,
    });
    expect(row('d1')).toMatchObject({
      open_days: 2,
      first_opened_at: NOW - 3 * DAY,
      last_opened_at: NOW - DAY,
      last_open_day: '2023-11-13',
      frecency_key: nextFrecencyKey(nextFrecencyKey(null, NOW - 3 * DAY), NOW - DAY),
    });
    expect(row('d2')).toBeUndefined();
    expect(row('d3')).toBeUndefined();
    expect(logs).toContain('home: frecency-seeded docs=1 days=2 conflicts=0 capped=no');
    expect(
      (await getScopeState(db.env, { scopeType: 'user', scopeId: 'me' }))?.frecencySeededAt,
    ).toBe(NOW);
  });

  it('adds only the days before the first recorded open, so no day counts twice', async () => {
    await recordDocumentOpen(
      db.env,
      { id: 'd1', name: 'd1', ownerId: 'me', teamId: null },
      'me',
      NOW - DAY,
    );
    edit('d1', NOW - DAY + 1000);
    edit('d1', NOW - 4 * DAY);

    await seedFrecency(db.env, 'me', NOW);
    const seeded = row('d1')!;
    expect(seeded).toMatchObject({
      open_days: 2,
      first_opened_at: NOW - 4 * DAY,
      last_opened_at: NOW - DAY,
    });
    expect(frecencyScore(seeded.frecency_key, NOW)).toBeCloseTo(
      frecencyScore(NOW - DAY, NOW) + frecencyScore(NOW - 4 * DAY, NOW),
      6,
    );
  });

  it('changes nothing when run again', async () => {
    edit('d1', NOW - 3 * DAY);
    edit('d2', NOW - DAY);
    await seedFrecency(db.env, 'me', NOW);
    const before = [row('d1'), row('d2')];
    expect(await seedFrecency(db.env, 'me', NOW + DAY)).toEqual({
      docs: 0,
      days: 0,
      conflicts: 0,
      capped: false,
    });
    expect([row('d1'), row('d2')]).toEqual(before);
  });

  it('reaches only the documents edited most recently', async () => {
    const insertDoc = db.sql.prepare(
      `INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, 'me', 'x', 0, 1, 1)`,
    );
    for (let i = 0; i <= FRECENCY_SEED_DOCUMENT_MAX; i += 1) {
      insertDoc.run(`many${i}`);
      edit(`many${i}`, NOW - i * 60_000);
    }
    const result = await seedFrecency(db.env, 'me', NOW);
    expect(result).toMatchObject({ docs: FRECENCY_SEED_DOCUMENT_MAX, capped: true });
    expect(row(`many${FRECENCY_SEED_DOCUMENT_MAX}`)).toBeUndefined();
    expect(logs.some((l) => l.endsWith('capped=yes'))).toBe(true);
  });
});
