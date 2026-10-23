import { describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { EMPTY_DESIGN_STALE_MS } from '@livedesign/api-schema';
import { sqliteD1 } from '../test-sqlite-d1';
import { trashEmptyDesigns } from './empty-design-sweep';
import { DAY, liveDoc, insert, team } from './test-trash-fixtures';
import { listTrash, restoreDesign, trashDesign } from './trash';

// The empty design clean-up (docs/specs/013-workspace/empty-design-cleanup.md),
// on a real SQLite with every migration applied: a design with no element on
// any tab, unsaved for 30 days, moves to the Trash marked `empty`; anything with
// content, or saved recently, stays.

const NOW = 1_800_000_000_000;
const STALE = NOW - EMPTY_DESIGN_STALE_MS;

const SHAPE = { id: 'e1', kind: 'shape', x: 0, y: 0, w: 10, h: 10 };

// A tab row linked into each of `designIds`, inserted directly so no write
// path stamps the design's saved_at. `data` is the stored JSON as given.
function tab(sql: DatabaseSync, id: string, data: unknown, ...designIds: string[]) {
  insert(sql, 'tabs', {
    id,
    name: id,
    data: typeof data === 'string' ? data : JSON.stringify(data),
    updated_at: 0,
  });
  designIds.forEach((designId, i) =>
    insert(sql, 'design_tabs', {
      design_id: designId,
      tab_id: id,
      order_index: i,
      added_at: 0,
    }),
  );
}

function state(sql: DatabaseSync, id: string) {
  return sql
    .prepare('SELECT trashed_at, trash_reason, saved_at FROM designs WHERE id = ?')
    .get(id) as { trashed_at: number | null; trash_reason: string | null; saved_at: number };
}

describe('designs.trash_reason', () => {
  it('adds a nullable trash_reason', () => {
    const { sql } = sqliteD1();
    const col = sql
      .prepare('PRAGMA table_info(designs)')
      .all()
      .find((c) => c.name === 'trash_reason');
    expect(col).toMatchObject({ type: 'TEXT', notnull: 0, dflt_value: null });
  });
});

describe('trashEmptyDesigns', () => {
  it('moves a design whose tabs hold no element, stamped with the sweep time', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'empty', { savedAt: STALE - DAY });
    tab(db.sql, 't1', { elements: [] }, 'empty');
    tab(db.sql, 't2', { elements: [] }, 'empty');

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(1);
    expect(state(db.sql, 'empty')).toMatchObject({ trashed_at: NOW, trash_reason: 'empty' });
  });

  it('treats a design with no tabs as empty', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'bare', { savedAt: STALE });

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(1);
  });

  it('keeps a design with an element on any tab', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'full', { savedAt: STALE - DAY });
    tab(db.sql, 't1', { elements: [] }, 'full');
    tab(db.sql, 't2', { elements: [SHAPE] }, 'full');

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(0);
    expect(state(db.sql, 'full').trashed_at).toBeNull();
  });

  it('keeps both designs sharing a tab that has elements', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'home', { savedAt: STALE - DAY });
    liveDoc(db.sql, 'guest', { savedAt: STALE - DAY });
    tab(db.sql, 'shared', { elements: [SHAPE] }, 'home', 'guest');

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(0);
  });

  it('counts a tab with no elements key as empty, and an unreadable tab as content', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'nokey', { savedAt: STALE });
    liveDoc(db.sql, 'broken', { savedAt: STALE });
    tab(db.sql, 'tn', { background: 'dots' }, 'nokey');
    tab(db.sql, 'tb', '{not json', 'broken');

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(1);
    expect(state(db.sql, 'nokey').trash_reason).toBe('empty');
    expect(state(db.sql, 'broken').trashed_at).toBeNull();
  });

  it('waits the full 30 days since the last save', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'due', { savedAt: STALE });
    liveDoc(db.sql, 'recent', { savedAt: STALE + 1 });

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(1);
    expect(state(db.sql, 'due').trash_reason).toBe('empty');
    expect(state(db.sql, 'recent').trashed_at).toBeNull();
  });

  it('covers team designs, which land in the team Trash', async () => {
    const db = sqliteD1();
    team(db.sql, 'tm', [['user_me', 'joined']]);
    liveDoc(db.sql, 'team-empty', { savedAt: STALE, team: 'tm', owner: 'user_bob' });

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(1);
    expect(await listTrash(db.env, { owner: 'user_me', verifiedUserId: 'user_me' })).toMatchObject([
      { id: 'team-empty', teamId: 'tm', reason: 'empty' },
    ]);
  });

  it('leaves a design already in the Trash with its first time and reason', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'binned', { savedAt: STALE - DAY });
    await trashDesign(db.env, 'binned', STALE);

    expect(await trashEmptyDesigns(db.env, NOW)).toBe(0);
    expect(state(db.sql, 'binned')).toMatchObject({ trashed_at: STALE, trash_reason: null });
  });

  it('caps each run, oldest save first, and drains the rest on later runs', async () => {
    const db = sqliteD1();
    for (let i = 0; i < 5; i++) liveDoc(db.sql, `d${i}`, { savedAt: STALE - (5 - i) * DAY });

    expect(await trashEmptyDesigns(db.env, NOW, { batch: 2, maxBatches: 1 })).toBe(2);
    expect(state(db.sql, 'd0').trash_reason).toBe('empty');
    expect(state(db.sql, 'd1').trash_reason).toBe('empty');
    expect(state(db.sql, 'd2').trashed_at).toBeNull();

    expect(await trashEmptyDesigns(db.env, NOW, { batch: 2, maxBatches: 5 })).toBe(3);
  });
});

describe('the Trash reason', () => {
  it('lists a deleted design as deleted and a swept one as empty', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'swept', { savedAt: STALE });
    liveDoc(db.sql, 'deleted', { savedAt: NOW });
    await trashEmptyDesigns(db.env, NOW);
    await trashDesign(db.env, 'deleted', NOW + 1);

    const rows = await listTrash(db.env, { owner: 'owner', verifiedUserId: null });
    expect(rows.map((r) => [r.id, r.reason])).toEqual([
      ['deleted', 'deleted'],
      ['swept', 'empty'],
    ]);
  });

  it('restoring a swept design clears the reason and restarts its 30 days', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'swept', { savedAt: STALE });
    await trashEmptyDesigns(db.env, NOW);

    expect(await restoreDesign(db.env, 'swept', NOW + DAY)).toBe(true);
    expect(state(db.sql, 'swept')).toEqual({
      trashed_at: null,
      trash_reason: null,
      saved_at: NOW + DAY,
    });
    // The next day's sweep leaves it alone.
    expect(await trashEmptyDesigns(db.env, NOW + 2 * DAY)).toBe(0);
  });

  it('restoring a deleted design keeps its last-saved time', async () => {
    const db = sqliteD1();
    liveDoc(db.sql, 'deleted', { savedAt: STALE - DAY });
    await trashDesign(db.env, 'deleted', NOW);

    await restoreDesign(db.env, 'deleted', NOW + DAY);
    expect(state(db.sql, 'deleted').saved_at).toBe(STALE - DAY);
  });
});
