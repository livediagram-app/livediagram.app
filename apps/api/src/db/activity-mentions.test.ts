import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/document';
import { sqliteD1 } from '../test-sqlite-d1';
import { readActivity } from './collab-index';
import { upsertTab } from './tabs';

// A thread @-mentioning somebody lands on THEIR Inbox even when they
// never commented and don't own the document (docs/specs/012-collaboration/comment-mentions.md "The
// Inbox"), still scoped to documents they can open (docs/specs/013-workspace/inbox.md §4).

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

function member(sql: DatabaseSync, id: string, userId: string | null, team = 'tm') {
  insert(sql, 'team_members', {
    id,
    team_id: team,
    user_id: userId,
    email: `${id}@example.com`,
    role: 'member',
    status: userId ? 'joined' : 'invited',
    created_at: T0,
    updated_at: T0,
  });
}

async function seed(mentions: unknown[], opts: { team?: string | null } = {}) {
  const db = sqliteD1();
  insert(db.sql, 'teams', { id: 'tm', name: 'Team', created_at: T0, updated_at: T0 });
  member(db.sql, 'm-owner', 'owner');
  member(db.sql, 'm-reader', 'reader');
  member(db.sql, 'm-other', 'other');
  insert(db.sql, 'documents', {
    id: 'D',
    owner_id: 'owner',
    name: 'Payments',
    shareable: 1,
    team_id: opts.team === undefined ? 'tm' : opts.team,
    saved_at: T0,
    created_at: T0,
  });
  const tab = {
    id: 't1',
    name: 'Flow',
    elements: [
      {
        id: 'e1',
        type: 'shape',
        shape: 'square',
        x: 0,
        y: 0,
        width: 100,
        height: 60,
        label: 'Checkout',
        commentThread: {
          resolved: false,
          comments: [
            {
              id: 'c1',
              text: 'hey @reader',
              createdAt: T0,
              authorName: 'Owner',
              authorColor: '#000',
              authorId: 'owner',
              mentions,
            },
          ],
        },
      },
    ],
  } as unknown as Tab;
  await upsertTab(db.env, 'D', tab, 0);
  return db;
}

describe('Activity: comment mentions', () => {
  it('lists the thread for the mentioned reader, flagged', async () => {
    const db = await seed([
      { userId: 'reader', memberId: 'm-reader', name: 'R', handle: 'reader' },
    ]);
    const { threads } = await readActivity(db.env, 'reader', { limit: 10 });
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      mentionsYou: true,
      youCommented: false,
      onYourDocument: false,
    });
  });

  it('finds a mention keyed only by the reader’s membership row', async () => {
    const db = await seed([{ userId: null, memberId: 'm-reader', name: 'R', handle: 'reader' }]);
    const { threads } = await readActivity(db.env, 'reader', { limit: 10 });
    expect(threads.map((t) => t.mentionsYou)).toEqual([true]);
  });

  it('leaves it off the page of a teammate nobody mentioned', async () => {
    const db = await seed([
      { userId: 'reader', memberId: 'm-reader', name: 'R', handle: 'reader' },
    ]);
    expect((await readActivity(db.env, 'other', { limit: 10 })).threads).toEqual([]);
  });

  it('never surfaces a document the mentioned person cannot open', async () => {
    const db = await seed(
      [{ userId: 'reader', memberId: 'm-reader', name: 'R', handle: 'reader' }],
      {
        team: null,
      },
    );
    expect((await readActivity(db.env, 'reader', { limit: 10 })).threads).toEqual([]);
  });

  it('marks the owner’s own row as not mentioning them', async () => {
    const db = await seed([
      { userId: 'reader', memberId: 'm-reader', name: 'R', handle: 'reader' },
    ]);
    const { threads } = await readActivity(db.env, 'owner', { limit: 10 });
    expect(threads.map((t) => t.mentionsYou)).toEqual([false]);
  });
});

// An Action panel's list (docs/specs/012-collaboration/action-panel.md "The data"): every action on one card
// is its own Activity row, through the real table and its per-action key.
describe('Activity: an Action panel with several actions', () => {
  it('lists each action on the card as its own row', async () => {
    const db = sqliteD1();
    insert(db.sql, 'documents', {
      id: 'D',
      owner_id: 'owner',
      name: 'Payments',
      shareable: 1,
      saved_at: T0,
      created_at: T0,
    });
    const action = (id: string, name: string) => ({
      id,
      name,
      description: '',
      assignee: { userId: 'owner', name: 'Me' },
      teamId: null,
      assignerId: 'owner',
      assignerName: 'Me',
      status: 'open',
      createdAt: T0,
      updatedAt: T0,
    });
    const tab = {
      id: 't1',
      name: 'Flow',
      elements: [
        {
          id: 'card',
          type: 'shape',
          shape: 'action-card',
          x: 0,
          y: 0,
          width: 300,
          height: 300,
          label: '',
          actions: [action('a1', 'Write the runbook'), action('a2', 'Load test')],
        },
      ],
    } as unknown as Tab;
    await upsertTab(db.env, 'D', tab, 0);
    const { actions } = await readActivity(db.env, 'owner', { limit: 10 });
    expect(actions.map((a) => a.name).sort()).toEqual(['Load test', 'Write the runbook']);
  });
});

// The cap (docs/specs/012-collaboration/action-panel.md "The data"): a hand-crafted save can't store or index
// an unbounded list.
describe('an Action panel list past the cap', () => {
  it('is trimmed to 50 in the stored tab and the index', async () => {
    const db = sqliteD1();
    insert(db.sql, 'documents', {
      id: 'D',
      owner_id: 'owner',
      name: 'Big',
      shareable: 1,
      saved_at: T0,
      created_at: T0,
    });
    const actions = Array.from({ length: 80 }, (_, i) => ({
      id: `a${i}`,
      name: `Action ${i}`,
      description: '',
      assignee: { userId: 'owner', name: 'Me' },
      teamId: null,
      assignerId: 'owner',
      assignerName: 'Me',
      status: 'open',
      createdAt: T0,
      updatedAt: T0,
    }));
    const tab = {
      id: 't1',
      name: 'T',
      elements: [
        {
          id: 'card',
          type: 'shape',
          shape: 'action-card',
          x: 0,
          y: 0,
          width: 300,
          height: 300,
          actions,
        },
      ],
    } as unknown as Tab;
    await upsertTab(db.env, 'D', tab, 0);
    const stored = db.sql.prepare('SELECT data FROM tabs WHERE id = ?').get('t1') as {
      data: string;
    };
    expect(JSON.parse(stored.data).elements[0].actions).toHaveLength(50);
    const rows = db.sql.prepare('SELECT COUNT(*) AS n FROM collab_actions').get() as { n: number };
    expect(rows.n).toBe(50);
  });
});
