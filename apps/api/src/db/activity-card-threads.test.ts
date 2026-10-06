// Plan card comment threads on the Activity page (docs/specs/013-workspace/activity-page.md §2.5, §4), against the
// real migrations: who a card's thread lists for (mentioned, commented, the document's owner), what drops it
// (resolved, archived, the Trash, a document the reader cannot open, a tab-scoped share whose boards miss it),
// and that author ids never leave the worker.

import type { Tab } from '@livediagram/document';
import type { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { CARD_THREADS_SQL, readActivity } from './collab-index';
import { seedTabs } from './tabs';

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

const KANBAN = {
  swimlaneBy: 'none',
  cardFields: [],
  title: 'Sprint',
  columns: [
    { id: 'todo', status: 'todo', name: 'To Do' },
    { id: 'done', status: 'done', name: 'Done' },
  ],
  doneColumnId: 'done',
};

const tab = (id: string, name: string, elements: unknown[]) =>
  ({ id, name, elements }) as unknown as Tab;

const comment = (
  id: string,
  at: number,
  over: { authorId?: string; mentions?: unknown[]; text?: string } = {},
) => ({
  id,
  text: over.text ?? `comment ${id}`,
  createdAt: at,
  authorName: `Author ${id}`,
  authorColor: '#123456',
  authorId: over.authorId ?? 'someone',
  ...(over.mentions ? { mentions: over.mentions } : {}),
});

async function setUp(opts: { team?: string | null; owner?: string } = {}) {
  const db = sqliteD1();
  insert(db.sql, 'teams', { id: 'tm', name: 'Team', created_at: T0, updated_at: T0 });
  for (const [id, userId] of [
    ['m-owner', 'owner'],
    ['m-reader', 'reader'],
  ] as const)
    insert(db.sql, 'team_members', {
      id,
      team_id: 'tm',
      user_id: userId,
      email: `${id}@example.com`,
      role: 'member',
      status: 'joined',
      created_at: T0,
      updated_at: T0,
    });
  insert(db.sql, 'documents', {
    id: 'D',
    owner_id: opts.owner ?? 'owner',
    name: 'Roadmap',
    shareable: 1,
    team_id: opts.team === undefined ? 'tm' : opts.team,
    saved_at: T0,
    created_at: T0,
  });
  await seedTabs(db.env, 'D', [
    tab('t-notes', 'Notes', []),
    tab('t-plan', 'Plan', [
      {
        id: 'b1',
        type: 'shape',
        shape: 'plan-board',
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        planBoard: KANBAN,
      },
    ]),
  ]);
  let key = 1;
  const card = (id: string, fields: Record<string, unknown>) =>
    insert(db.sql, 'items', {
      document_id: 'D',
      id,
      type: 'task',
      item_key: key++,
      rank: 'a0',
      fields: JSON.stringify({ title: id, status: 'todo', ...fields }),
      rev: 1,
      created_at: T0,
      updated_at: T0,
      created_by: '{}',
      updated_by: '{}',
    });
  const read = async (who = 'reader') =>
    (await readActivity(db.env, who, { limit: 100 })).cardThreads;
  return { ...db, card, read };
}

const thread = (comments: unknown[], resolved = false) => ({ comments: { comments, resolved } });

describe('Activity: Plan card comment threads', () => {
  it('lists a thread that mentions the reader, placed on its board, without author ids', async () => {
    const { card, read } = await setUp();
    card(
      'c1',
      thread([
        comment('a', T0 + 1),
        comment('b', T0 + 2, {
          text: 'Can you look, @reader?',
          mentions: [{ userId: 'reader', name: 'Reader', handle: 'reader' }],
        }),
      ]),
    );
    const rows = await read();
    expect(rows).toEqual([
      {
        documentId: 'D',
        documentName: 'Roadmap',
        teamId: 'tm',
        via: 'team',
        shareCode: null,
        board: { tabId: 't-plan', tabName: 'Plan', elementId: 'b1', title: 'Sprint' },
        id: 'c1',
        key: 1,
        type: 'task',
        title: 'c1',
        commentCount: 2,
        latest: {
          text: 'Can you look, @reader?',
          authorName: 'Author b',
          authorColor: '#123456',
          at: T0 + 2,
        },
        firstAt: T0 + 1,
        youCommented: false,
        onYourDocument: false,
        mentionsYou: true,
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain('someone');
  });

  it('matches a mention by the reader’s membership row, and lists threads they wrote in', async () => {
    const { card, read } = await setUp();
    card(
      'by-member',
      thread([comment('a', T0 + 5, { mentions: [{ userId: null, memberId: 'm-reader' }] })]),
    );
    card('wrote', thread([comment('a', T0 + 4, { authorId: 'reader' })]));
    card('elsewhere', thread([comment('a', T0 + 3)]));
    const rows = await read();
    expect(rows.map((r) => [r.id, r.mentionsYou, r.youCommented])).toEqual([
      ['by-member', true, false],
      ['wrote', false, true],
    ]);
  });

  it('lists every open card thread on a document the reader owns', async () => {
    const { card, read } = await setUp({ owner: 'reader' });
    card('c1', thread([comment('a', T0 + 1)]));
    expect((await read()).map((r) => [r.id, r.onYourDocument])).toEqual([['c1', true]]);
  });

  it('leaves out resolved threads, empty threads, archived cards and cards in the Trash', async () => {
    const { card, read } = await setUp({ owner: 'reader' });
    card('resolved', thread([comment('a', T0)], true));
    card('empty', thread([]));
    card('archived', { archived: true, ...thread([comment('a', T0)]) });
    card('trashed', { status: 'trash', ...thread([comment('a', T0)]) });
    card('no-thread', {});
    expect(await read()).toEqual([]);
  });

  it('never surfaces a document the reader cannot open', async () => {
    const { card, read } = await setUp({ team: null });
    card('c1', thread([comment('a', T0, { mentions: [{ userId: 'reader' }] })]));
    expect(await read()).toEqual([]);
  });

  it('on a tab-scoped share, lists only cards that tab’s boards show', async () => {
    const { card, read, sql } = await setUp({ team: null });
    const mention = [comment('a', T0, { mentions: [{ userId: 'reader' }] })];
    card('on-plan', { status: 'todo', ...thread(mention) });
    card('stray', { status: 'blocked', ...thread(mention) });
    sql.exec(`INSERT INTO share_links (code, document_id, role, tab_id, created_at)
              VALUES ('code-plan', 'D', 'edit', 't-plan', 1)`);
    sql.exec(`INSERT INTO shared_with (owner_id, document_id, role, tab_id, last_seen)
              VALUES ('reader', 'D', 'edit', 't-plan', 1)`);
    expect((await read()).map((r) => [r.id, r.via, r.shareCode])).toEqual([
      ['on-plan', 'shared', 'code-plan'],
    ]);
  });

  // docs/specs/013-workspace/activity-page.md §2.5: the scope comes first, so the item store is only ever read
  // per visible document (its primary key), never scanned whole.
  it('reads items per visible document, never scanning the store', async () => {
    const { sql } = await setUp();
    const plan = sql
      .prepare(`EXPLAIN QUERY PLAN ${CARD_THREADS_SQL}`)
      .all('reader', 1, 100)
      .map((p) => String(p['detail']));
    expect(plan.filter((d) => /^SCAN (i|items)\b/.test(d))).toEqual([]);
    expect(plan.join('\n')).toContain('USING INDEX items_open_threads');
  });
});
