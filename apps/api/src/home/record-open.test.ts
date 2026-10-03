import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import { recordDocumentOpen } from './record-open';

// Recording an open (docs/specs/013-workspace/explorer-home.md "Opens"; blueprint "Recording an
// open"): the day once per person per document per UTC day, the row first, then a private event;
// every open moves the last open.

const DAY = 24 * 60 * 60 * 1000;
// 2023-11-14 22:13:20 UTC.
const NOW = 1_700_000_000_000;
let db: SqliteD1;
let logs: string[];

const DOC = { id: 'd1', name: 'Payments', ownerId: 'owner', teamId: null };

function openRow(ownerId = 'me') {
  return db.sql
    .prepare('SELECT * FROM document_opens WHERE owner_id = ? AND document_id = ?')
    .get(ownerId, 'd1') as
    | { last_opened_at: number; last_open_day: string }
    | undefined;
}

function openedEvents() {
  return db.sql
    .prepare(
      `SELECT e.actor_id, e.occurred_at, e.dedupe_key, s.scope_type, s.scope_id
         FROM timeline_events e JOIN timeline_event_scopes s ON s.event_id = e.id
        WHERE e.event_type = 'document_opened'`,
    )
    .all() as { actor_id: string; occurred_at: number; scope_type: string; scope_id: string }[];
}

beforeEach(() => {
  db = sqliteD1();
  db.sql.exec(`INSERT INTO documents (id, owner_id, name, shareable, saved_at, created_at)
               VALUES ('d1', 'owner', 'Payments', 1, 1, 1)`);
  logs = [];
  const capture = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('recordDocumentOpen', () => {
  it('records a first open: the day, the last open, and a private event', async () => {
    await recordDocumentOpen(db.env, DOC, 'me', NOW);
    expect(openRow()).toEqual({
      owner_id: 'me',
      document_id: 'd1',
      last_opened_at: NOW,
      last_open_day: '2023-11-14',
    });
    expect(openedEvents()).toEqual([
      expect.objectContaining({
        actor_id: 'me',
        occurred_at: NOW,
        scope_type: 'user',
        scope_id: 'me',
      }),
    ]);
    expect(logs).toContain('home: open-recorded doc=d1');
  });

  it('counts a day once, but moves the last open on every open that day', async () => {
    await recordDocumentOpen(db.env, DOC, 'me', NOW);
    await recordDocumentOpen(db.env, DOC, 'me', NOW + 60_000);
    expect(openRow()).toMatchObject({ last_opened_at: NOW + 60_000, last_open_day: '2023-11-14' });
    expect(openedEvents()).toHaveLength(1);
    expect(logs).toContain('home: open-touched doc=d1');
  });

  it('never moves the last open backwards', async () => {
    await recordDocumentOpen(db.env, DOC, 'me', NOW + 60_000);
    await recordDocumentOpen(db.env, DOC, 'me', NOW);
    expect(openRow()!.last_opened_at).toBe(NOW + 60_000);
  });

  it('counts the next day with a second event', async () => {
    await recordDocumentOpen(db.env, DOC, 'me', NOW);
    await recordDocumentOpen(db.env, DOC, 'me', NOW + DAY);
    expect(openRow()).toMatchObject({ last_opened_at: NOW + DAY, last_open_day: '2023-11-15' });
    expect(openedEvents()).toHaveLength(2);
  });

  it('lets one of two racing first opens through', async () => {
    await Promise.all([
      recordDocumentOpen(db.env, DOC, 'me', NOW),
      recordDocumentOpen(db.env, DOC, 'me', NOW + 1),
    ]);
    expect(openRow()!.last_open_day).toBe('2023-11-14');
    expect(openedEvents()).toHaveLength(1);
    expect(logs.some((l) => /open-(skipped reason=race|touched) doc=d1/.test(l))).toBe(true);
  });

  it("keeps each person's opens apart, and never in the document's or anyone else's scope", async () => {
    await recordDocumentOpen(db.env, DOC, 'me', NOW);
    await recordDocumentOpen(db.env, DOC, 'visitor', NOW);
    expect(openRow('me')!.last_opened_at).toBe(NOW);
    expect(openRow('visitor')!.last_opened_at).toBe(NOW);
    expect(
      openedEvents()
        .map((e) => `${e.scope_type}:${e.scope_id}`)
        .sort(),
    ).toEqual(['user:me', 'user:visitor']);
  });

  it('logs and swallows a failure', async () => {
    const broken = {
      ...db.env,
      DB: {
        prepare: () => {
          throw new Error('d1 down');
        },
      },
    };
    await expect(recordDocumentOpen(broken as never, DOC, 'me', NOW)).resolves.toBeUndefined();
    expect(logs.some((l) => l.startsWith('home: open-failed doc=d1'))).toBe(true);
  });
});
