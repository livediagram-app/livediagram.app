// Plan cards on the Activity page (docs/specs/013-workspace/activity-page.md §2.4, §4), against the real
// migrations: the hashed-assignee match, what counts as open, where a row opens the card, and the library
// scope that keeps a card off the page of someone who cannot open its document.

import type { Tab } from '@livediagram/document';
import { itemPersonId } from '@livediagram/items';
import type { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { CARDS_SQL, readActivity } from './collab-index';
import { copyDocument } from './documents';
import { seedTabs, upsertTab } from './tabs';

const T0 = 1_700_000_000_000;

function insert(sql: DatabaseSync, table: string, row: Record<string, string | number | null>) {
  const cols = Object.keys(row);
  sql
    .prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...Object.values(row));
}

const board = (id: string, setup: Record<string, unknown>) => ({
  id,
  type: 'shape',
  shape: 'plan-board',
  x: 0,
  y: 0,
  width: 1120,
  height: 640,
  planBoard: { swimlaneBy: 'none', cardFields: [], ...setup },
});

const KANBAN = {
  title: 'Sprint',
  columns: [
    { id: 'todo', status: 'todo', name: 'To Do' },
    { id: 'doing', status: 'doing', name: 'Doing' },
    { id: 'done', status: 'done', name: 'Done' },
    { id: 'shipped', status: 'shipped', name: 'Shipped' },
  ],
  doneColumnId: 'done',
};

const tab = (id: string, name: string, elements: unknown[]) =>
  ({ id, name, elements }) as unknown as Tab;

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
    tab('t-plan', 'Plan', [board('b1', KANBAN)]),
  ]);
  let key = 1;
  const card = async (
    id: string,
    fields: Record<string, unknown>,
    over: { assignee?: string | null; updatedAt?: number } = {},
  ) => {
    const assignee =
      over.assignee === null
        ? {}
        : {
            assignee: {
              id: await itemPersonId(over.assignee ?? 'reader'),
              name: 'Reader',
              color: '#336699',
            },
          };
    insert(db.sql, 'items', {
      document_id: 'D',
      id,
      type: 'task',
      item_key: key++,
      rank: 'a0',
      fields: JSON.stringify({ title: id, status: 'todo', ...assignee, ...fields }),
      rev: 1,
      created_at: T0,
      updated_at: over.updatedAt ?? T0,
      created_by: '{}',
      updated_by: '{}',
    });
  };
  const read = async (who = 'reader') => (await readActivity(db.env, who, { limit: 100 })).cards;
  return { ...db, card, read };
}

describe('Activity: Plan cards assigned to the reader', () => {
  it('lists a card assigned to the reader, opened on the board holding its status', async () => {
    const { card, read } = await setUp();
    await card('c1', { title: 'Write the brief' });
    expect(await read()).toEqual([
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
        title: 'Write the brief',
        status: 'todo',
        updatedAt: T0,
      },
    ]);
  });

  it('leaves off cards on someone else, or on nobody', async () => {
    const { card, read } = await setUp();
    await card('theirs', {}, { assignee: 'owner' });
    await card('nobody', {}, { assignee: null });
    expect(await read()).toEqual([]);
    expect((await read('owner')).map((c) => c.id)).toEqual(['theirs']);
  });

  it('finds a card assigned to an identity the reader used to be', async () => {
    const { card, read, sql } = await setUp();
    insert(sql, 'owner_aliases', { owner_id: 'reader', alias_id: 'guest-1', created_at: T0 });
    await card('as-guest', {}, { assignee: 'guest-1' });
    expect((await read()).map((c) => c.id)).toEqual(['as-guest']);
  });

  it('drops archived and trashed cards', async () => {
    const { card, read } = await setUp();
    await card('archived', { archived: true });
    await card('trashed', { status: 'trash', trashedFrom: 'todo' });
    await card('live', {});
    expect((await read()).map((c) => c.id)).toEqual(['live']);
  });

  it('drops a card whose status is the done column or after it', async () => {
    const { card, read } = await setUp();
    await card('doing', { status: 'doing' });
    await card('done', { status: 'done' });
    await card('shipped', { status: 'shipped' });
    expect((await read()).map((c) => c.id)).toEqual(['doing']);
  });

  it('follows the board: moving the done column re-opens a card', async () => {
    const { env, card, read } = await setUp();
    await card('shipped', { status: 'shipped' });
    expect(await read()).toEqual([]);
    await upsertTab(
      env,
      'D',
      tab('t-plan', 'Plan', [board('b1', { ...KANBAN, doneColumnId: undefined })]),
      1,
    );
    expect((await read()).map((c) => c.id)).toEqual(['shipped']);
  });

  it('keeps a stray status open, landing on any board', async () => {
    const { card, read } = await setUp();
    await card('stray', { status: 'blocked' });
    const [row] = await read();
    expect(row?.board).toMatchObject({ elementId: 'b1' });
  });

  it('prefers a board holding the status, then an All Cards board', async () => {
    const { env, card, read } = await setUp();
    await upsertTab(
      env,
      'D',
      tab('t-notes', 'Notes', [
        board('all', { title: 'Everything', allCards: true, columns: [] }),
        board('other', { title: 'Bugs', columns: [{ id: 'triage', status: 'triage', name: 'T' }] }),
      ]),
      0,
    );
    await card('todo', { status: 'todo' }, { updatedAt: T0 + 2 });
    await card('stray', { status: 'blocked' }, { updatedAt: T0 + 1 });
    const rows = await read();
    expect(rows.map((c) => [c.id, c.board?.elementId])).toEqual([
      ['todo', 'b1'],
      ['stray', 'all'],
    ]);
  });

  it('lists a card in a document with no board, with nowhere to land', async () => {
    const { env, card, read } = await setUp();
    await upsertTab(env, 'D', tab('t-plan', 'Plan', []), 1);
    await card('loose', {});
    expect((await read()).map((c) => [c.id, c.board])).toEqual([['loose', null]]);
  });

  it('never surfaces a document the reader cannot open', async () => {
    const { card, read } = await setUp({ team: null });
    await card('c1', {});
    expect(await read()).toEqual([]);
  });

  it('on a tab-scoped share, lists only cards that tab’s boards show', async () => {
    const { card, read, sql } = await setUp({ team: null });
    await card('on-plan', { status: 'todo' });
    await card('stray', { status: 'blocked' });
    sql.exec(`INSERT INTO share_links (code, document_id, role, tab_id, created_at)
              VALUES ('code-plan', 'D', 'edit', 't-plan', 1), ('code-notes', 'D', 'edit', 't-notes', 1)`);
    sql.exec(`INSERT INTO shared_with (owner_id, document_id, role, tab_id, last_seen)
              VALUES ('reader', 'D', 'edit', 't-plan', 1)`);
    const rows = await read();
    expect(rows.map((c) => [c.id, c.via, c.shareCode, c.board?.tabId])).toEqual([
      ['on-plan', 'shared', 'code-plan', 't-plan'],
    ]);
    sql.exec(`UPDATE shared_with SET tab_id = 't-notes'`);
    expect(await read()).toEqual([]);
  });

  it('copies the board index with a duplicated document', async () => {
    const { env, sql, read } = await setUp({ owner: 'reader' });
    await copyDocument(env, 'D', 'D2', 'reader', 'Copy');
    const boards = sql
      .prepare(
        `SELECT dt.document_id, pb.element_id FROM plan_board_statuses pb
           JOIN document_tabs dt ON dt.tab_id = pb.tab_id WHERE pb.status = 'todo'`,
      )
      .all();
    expect(boards).toHaveLength(2);
    expect(boards.map((b) => b['document_id']).sort()).toEqual(['D', 'D2']);
    expect(await read()).toEqual([]);
  });

  // docs/specs/013-workspace/activity-page.md §2.4: the read seeks the reader's cards by the assignee
  // index and each card's Done check by (tab, status), never scanning the item store or a tab's boards.
  // Measured: 100,000 cards, 2,000 on the reader, read in ~25ms; the Done check without the seek took ~270ms.
  it('seeks cards by assignee and the Done check by tab and status', async () => {
    const { sql } = await setUp();
    const plan = sql
      .prepare(`EXPLAIN QUERY PLAN ${CARDS_SQL}`)
      .all('reader', 1, 100, '["x"]')
      .map((p) => String(p['detail']));
    expect(plan.join('\n')).toContain('SEARCH i USING INDEX items_assignee');
    expect(plan.some((d) => /plan_board_statuses.*\(tab_id=\? AND status=\?\)/.test(d))).toBe(true);
    expect(plan.filter((d) => /^SCAN (i|items|pb)\b/.test(d))).toEqual([]);
  });
});
