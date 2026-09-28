import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { Tab } from '@livediagram/diagram';
import { sqliteD1 } from '../test-sqlite-d1';
import { readActivity } from './collab-index';
import { upsertTab } from './tabs';

// A thread @-mentioning somebody lands on THEIR Activity page even when they
// never commented and don't own the diagram (docs/specs/012-collaboration/comment-mentions.md "The
// Activity page"), still scoped to diagrams they can open (docs/specs/013-workspace/activity-page.md §4).

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
  insert(db.sql, 'diagrams', {
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
      onYourDiagram: false,
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

  it('never surfaces a diagram the mentioned person cannot open', async () => {
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
