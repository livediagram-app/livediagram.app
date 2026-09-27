import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { applyMigration, sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import {
  isImageRefIndexComplete,
  readImageRefsBackfill,
  resetImageRefIndexMemo,
} from '../db/image-refs';
import {
  IMAGE_REFS_BACKFILL_BUDGET_MS,
  IMAGE_REFS_BACKFILL_PAGE_ROWS,
  IMAGE_REFS_BACKFILL_SETTLE_MS,
  runImageRefsBackfill,
} from './backfill';

// The one-off indexing of tabs saved before migration 0050
// (docs/specs/009-elements/images.md, "Reference index", Backfill). Until it
// completes the sweep deletes nothing, so what matters is that it reaches
// every tab, survives being cut short, and keeps a corrupt tab's images.

const body = (...imageIds: string[]) =>
  JSON.stringify({
    elements: imageIds.map((imageId, i) => ({ id: `e${i}`, type: 'image', imageId })),
  });

function tabRow(sql: DatabaseSync, id: string, data: string) {
  sql
    .prepare('INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 0)')
    .run(id, id, data);
}

function refCount(sql: DatabaseSync): number {
  return Number(sql.prepare('SELECT COUNT(*) AS n FROM image_refs').get()!.n);
}

// A database that had `tabs` before 0050 ran, so the backfill starts pending.
function legacy(tabs: Record<string, string>): SqliteD1 {
  const db = sqliteD1({}, { before: '0050' });
  for (const [id, data] of Object.entries(tabs)) tabRow(db.sql, id, data);
  applyMigration(db.sql, '0050');
  return db;
}

function createdAt(db: SqliteD1): number {
  return Number(db.sql.prepare('SELECT created_at FROM image_refs_backfill').get()!.created_at);
}

// A clock that has spent the whole budget after `ticks` reads.
function budgetClock(ticks: number): () => number {
  let reads = 0;
  return () => (reads++ < ticks ? 0 : IMAGE_REFS_BACKFILL_BUDGET_MS);
}

afterEach(() => {
  resetImageRefIndexMemo();
  vi.restoreAllMocks();
});

describe('runImageRefsBackfill', () => {
  it('waits out the settle period after the migration', async () => {
    const db = legacy({ t1: body('a') });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const res = await runImageRefsBackfill(
      db.env,
      createdAt(db) + IMAGE_REFS_BACKFILL_SETTLE_MS - 1,
    );
    expect(res).toEqual({ state: 'settling' });
    expect(refCount(db.sql)).toBe(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('image-refs backfill: settling'));
  });

  it('indexes every tab and completes', async () => {
    const db = legacy({ t1: body('a'), t2: body('b', 'c'), t3: body() });
    const now = createdAt(db) + IMAGE_REFS_BACKFILL_SETTLE_MS;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runImageRefsBackfill(db.env, now)).toEqual({ state: 'complete' });
    expect(refCount(db.sql)).toBe(3);
    expect(await readImageRefsBackfill(db.env)).toMatchObject({ cursor: 3, completed_at: now });
    expect(await isImageRefIndexComplete(db.env)).toBe(true);
  });

  it('stops at the budget and resumes where it left off, reaching tabs added meanwhile', async () => {
    const tabs: Record<string, string> = {};
    for (let i = 0; i < IMAGE_REFS_BACKFILL_PAGE_ROWS + 20; i++) tabs[`t${i}`] = body(`i${i}`);
    const db = legacy(tabs);
    const now = createdAt(db) + IMAGE_REFS_BACKFILL_SETTLE_MS;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Budget read at the start and once per loop: one page, then out of time.
    expect(await runImageRefsBackfill(db.env, now, budgetClock(2))).toEqual({ state: 'running' });
    expect(refCount(db.sql)).toBe(IMAGE_REFS_BACKFILL_PAGE_ROWS);
    expect(await readImageRefsBackfill(db.env)).toMatchObject({
      cursor: IMAGE_REFS_BACKFILL_PAGE_ROWS,
      completed_at: null,
    });
    expect(log).toHaveBeenCalledWith(
      `image-refs backfill: indexed tabs 0..${IMAGE_REFS_BACKFILL_PAGE_ROWS}`,
    );

    // A tab written by a worker that predates the index, after the first run.
    tabRow(db.sql, 'late', body('late-img'));
    expect(await runImageRefsBackfill(db.env, now)).toEqual({ state: 'complete' });
    expect(refCount(db.sql)).toBe(IMAGE_REFS_BACKFILL_PAGE_ROWS + 21);
  });

  it("keeps a corrupt tab's images by scanning its text", async () => {
    const db = legacy({ bad: '{"elements":[{"type":"image","imageId":"kept"}', good: body('g') });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await runImageRefsBackfill(db.env, createdAt(db) + IMAGE_REFS_BACKFILL_SETTLE_MS);
    const refs = db.sql
      .prepare('SELECT tab_id, image_id FROM image_refs ORDER BY tab_id')
      .all()
      .map((r) => `${r.tab_id as string}:${r.image_id as string}`);
    expect(refs).toEqual(['bad:kept', 'good:g']);
    expect(warn).toHaveBeenCalledWith(
      'image-refs backfill: corrupt tab bad scanned as text (1 ids)',
    );
  });

  it('passes a corrupt tab that names no usable id', async () => {
    const db = legacy({ bad: '{"elements":[{"type":"image","imageId":null}' });
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(
      await runImageRefsBackfill(db.env, createdAt(db) + IMAGE_REFS_BACKFILL_SETTLE_MS),
    ).toEqual({
      state: 'complete',
    });
    expect(refCount(db.sql)).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      'image-refs backfill: corrupt tab bad scanned as text (0 ids)',
    );
  });

  it('completes when every tab it was waiting on is gone', async () => {
    const db = legacy({ t1: body('a') });
    db.sql.exec('DELETE FROM tabs');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(
      await runImageRefsBackfill(db.env, createdAt(db) + IMAGE_REFS_BACKFILL_SETTLE_MS),
    ).toEqual({
      state: 'complete',
    });
  });

  it('is idempotent over references a save already wrote', async () => {
    const db = legacy({ t1: body('a') });
    db.sql.exec("INSERT INTO image_refs (tab_id, image_id) VALUES ('t1', 'a')");
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await runImageRefsBackfill(db.env, createdAt(db) + IMAGE_REFS_BACKFILL_SETTLE_MS);
    expect(refCount(db.sql)).toBe(1);
  });

  it('does nothing once complete', async () => {
    const db = sqliteD1();
    tabRow(db.sql, 't1', body('a'));
    expect(await runImageRefsBackfill(db.env, Date.now())).toEqual({ state: 'complete' });
    expect(refCount(db.sql)).toBe(0);
  });

  it('restarts from the first tab when its state row is missing', async () => {
    const db = sqliteD1();
    db.sql.exec('DELETE FROM image_refs_backfill');
    tabRow(db.sql, 't1', body('a'));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await runImageRefsBackfill(db.env, 1_000)).toEqual({ state: 'settling' });
    expect(await readImageRefsBackfill(db.env)).toEqual({
      created_at: 1_000,
      cursor: 0,
      completed_at: null,
    });
    expect(warn).toHaveBeenCalledWith('image-refs backfill: state row missing; restarting');
    expect(await runImageRefsBackfill(db.env, 1_000 + IMAGE_REFS_BACKFILL_SETTLE_MS)).toEqual({
      state: 'complete',
    });
    expect(refCount(db.sql)).toBe(1);
  });
});
