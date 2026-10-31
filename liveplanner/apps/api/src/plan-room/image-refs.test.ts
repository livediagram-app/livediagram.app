import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { sqliteD1, type SqliteD1 } from '../test-sqlite-d1';
import type { Env } from '../types';
import { recordImageGrant, planServesImage } from './image-grants';
import { PLACED_IMAGES_SQL, forgetImageRefs, placedImageIds, pushImageRefs } from './image-refs';
import { migratePlanSchema } from './plan-schema';
import { planNamespace } from './test-plan-namespace';

// Which pictures a plan's cards hold, told to the media service (docs/specs/026-plan/items.md "Images in use"): the
// triggers queue an `images` key on a card write that could change the set, the drain sends it only when it changed,
// and a purge sends an empty set. The service is a recording fake behind `fetch`.

const PLAN = 'plan-1';
const MEDIA_URL = 'https://media.test/api/media';

// The pictures the `at`th report named for the plan.
const imagesSent = (at: number) => {
  const { documents: sent } = synced.at(at)!;
  return sent[0]!.images;
};

let synced: { documents: { document: string; images: string[] }[]; complete?: boolean }[];
let refuse: boolean;

beforeEach(() => {
  synced = [];
  refuse = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith('/app/refs')) {
        if (refuse) return Response.json({ error: 'nope' }, { status: 500 });
        synced.push(JSON.parse(init?.body as string) as (typeof synced)[number]);
        return Response.json({ ok: true });
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const pic = (id: string, cover = false) => ({
  id,
  name: `${id}.png`,
  size: 100,
  type: 'image/png',
  ...(cover ? { cover: true } : {}),
});

function plan(base: Partial<Env> = { MEDIA_KEY: 'k', MEDIA_URL }) {
  const db: SqliteD1 = sqliteD1(base);
  db.sql.prepare('INSERT INTO plan (id, saved_at, created_at) VALUES (?, 1, 1)').run(PLAN);
  let key = 0;
  const card = (id: string, fields: Record<string, unknown>) => {
    key += 1;
    db.sql
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, 'task', ?, 'a', ?, 1, 1, 1, '{}', '{}')`,
      )
      .run(PLAN, id, key, JSON.stringify(fields));
  };
  const edit = (id: string, fields: Record<string, unknown>) =>
    db.sql
      .prepare('UPDATE items SET fields = ? WHERE plan_id = ? AND id = ?')
      .run(JSON.stringify(fields), PLAN, id);
  const queued = () =>
    db.sql.prepare("SELECT 1 FROM outbox WHERE kind = 'images'").all().length > 0;
  const grant = (id: string) => recordImageGrant(nodeItemSql(db.sql), PLAN, id, 1);
  return { ...db, card, edit, queued, grant };
}

describe('the images key', () => {
  it('is queued by a card holding attachments, and by any card write while the plan holds a grant', () => {
    const p = plan();
    p.card('plain', { title: 'No pictures' });
    expect(p.queued()).toBe(false);
    p.card('files', { title: 'Shots', attachments: [pic('a')] });
    expect(p.queued()).toBe(true);
    p.sql.exec('DELETE FROM outbox');
    p.edit('files', { title: 'Shots' });
    expect(p.queued()).toBe(true);
    p.sql.exec('DELETE FROM outbox');
    p.grant('img-1');
    p.edit('plain', { title: 'Now a photo', photo: 'img-1' });
    expect(p.queued()).toBe(true);
    p.sql.exec('DELETE FROM outbox');
    p.sql.prepare('DELETE FROM items WHERE id = ?').run('plain');
    expect(p.queued()).toBe(true);
  });

  it('is queued once for a plan that held a grant before its schema reported pictures', () => {
    const db = new DatabaseSync(':memory:');
    const sql = nodeItemSql(db);
    migratePlanSchema((q) => sql.exec(q));
    db.exec("INSERT INTO plan (id, saved_at, created_at) VALUES ('p', 1, 1)");
    db.exec("INSERT INTO card_image_grants (plan_id, image_id, created_at) VALUES ('p', 'x', 1)");
    // Run the reporting step again, as a plan woken after it ships does (every statement is IF NOT EXISTS).
    db.exec('DELETE FROM outbox');
    db.exec('UPDATE _plan_schema SET version = 9');
    migratePlanSchema((q) => sql.exec(q));
    expect(db.prepare("SELECT kind FROM outbox WHERE kind = 'images'").all()).toHaveLength(1);
  });
});

describe('the pictures a plan reports', () => {
  it('are its cards’ attachments and the Image field values it holds a grant for, sorted, once each', async () => {
    const p = plan();
    p.card('a', { attachments: [pic('z'), pic('m', true)] });
    p.card('b', { attachments: [pic('m')], photo: 'granted', other: 'not-granted' });
    p.card('c', { description: 'mentions "attachments" in passing' });
    p.grant('granted');
    expect(await placedImageIds(p.env, PLAN)).toEqual(['granted', 'm', 'z']);
  });

  it('are sent whole, never claiming the app complete, then only when the set changes', async () => {
    const p = plan();
    p.card('a', { attachments: [pic('one')] });
    await p.flush();
    expect(synced).toEqual([{ documents: [{ document: PLAN, images: ['one'] }] }]);
    p.edit('a', { title: 'Renamed', attachments: [pic('one', true)] });
    await p.flush();
    expect(synced).toHaveLength(1);
    expect(p.queued()).toBe(false);
    p.edit('a', { attachments: [pic('one'), pic('two')] });
    await p.flush();
    expect(imagesSent(-1)).toEqual(['one', 'two']);
    // A card deleted for good no longer places them: the sweep may take them.
    p.sql.prepare('DELETE FROM items WHERE id = ?').run('a');
    await p.flush();
    expect(imagesSent(-1)).toEqual([]);
  });

  it('sends nothing past what one sync carries, so no reference is dropped, and says so', async () => {
    const p = plan();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    p.card('first', { attachments: [pic('kept')] });
    await p.flush();
    expect(imagesSent(0)).toEqual(['kept']);
    for (let c = 0; c < 26; c++) {
      p.card(`c${c}`, { attachments: Array.from({ length: 20 }, (_, i) => pic(`p${c}-${i}`)) });
    }
    await p.flush();
    expect(synced).toHaveLength(1);
    expect(error).toHaveBeenCalledWith(
      '[media] a plan holds more pictures than one sync carries; not reported',
      expect.objectContaining({ images: 521 }),
    );
    error.mockRestore();
  });

  it('tells the service nothing for a plan that never held a picture', async () => {
    const p = plan();
    p.card('a', { attachments: [pic('one')] });
    p.edit('a', { title: 'none now' });
    await p.flush();
    expect(synced).toEqual([]);
  });

  it('keeps the key to try again when the service refuses', async () => {
    const p = plan();
    p.card('a', { attachments: [pic('one')] });
    refuse = true;
    await expect(p.flush()).rejects.toThrow('media refs sync failed');
    expect(p.queued()).toBe(true);
    refuse = false;
    await p.flush();
    expect(synced).toHaveLength(1);
    expect(p.queued()).toBe(false);
  });

  it('drops the key without the media service', async () => {
    const p = plan({});
    p.card('a', { attachments: [pic('one')] });
    expect(await pushImageRefs(p.env, PLAN)).toBe(false);
    await p.flush();
    expect(p.queued()).toBe(false);
    expect(synced).toEqual([]);
  });

  // A board's whole set, worked out on a full plan (2,000 cards, a quarter holding three pictures each). Measured at
  // 3.8 ms on a loaded laptop (both scans, the plan holding a grant); the budget fails only on a quadratic turn.
  it('stays cheap on a plan of 2,000 cards', async () => {
    const p = plan();
    const filler = 'x'.repeat(400);
    for (let i = 0; i < 2000; i++) {
      p.card(`c${i}`, {
        title: `Card ${i}`,
        description: filler,
        ...(i % 4 === 0 ? { attachments: [pic(`a${i}`), pic(`b${i}`), pic(`c${i}`)] } : {}),
      });
    }
    expect(await placedImageIds(p.env, PLAN)).toHaveLength(1500);
    p.grant('g');
    // The query placedImageIds runs, timed synchronously: the attachments' scan and the granted values' scan.
    const query = p.sql.prepare(PLACED_IMAGES_SQL);
    const runs = 5;
    const cost = cpuMsOf(() => {
      for (let i = 0; i < runs; i++) query.all(PLAN);
    });
    expect(cost / runs).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('serving an attachment', () => {
  it('serves a picture a card’s Attachments hold, with the grant, and nothing else', () => {
    const p = plan();
    const sql = nodeItemSql(p.sql);
    p.card('a', { attachments: [pic('held')], note: 'mentions held' });
    expect(planServesImage(sql, PLAN, 'held')).toBe(false);
    p.grant('held');
    expect(planServesImage(sql, PLAN, 'held')).toBe(true);
    p.grant('other');
    p.card('b', { list: [{ id: 'other' }] });
    expect(planServesImage(sql, PLAN, 'other')).toBe(false);
  });
});

describe('a purged plan', () => {
  it('tells the service it places nothing, once it had said it placed something', async () => {
    await forgetImageRefs({ MEDIA_KEY: 'k', MEDIA_URL }, PLAN, null);
    await forgetImageRefs({ MEDIA_KEY: 'k', MEDIA_URL }, PLAN, '[]');
    await forgetImageRefs({}, PLAN, '["a"]');
    expect(synced).toEqual([]);
    await forgetImageRefs({ MEDIA_KEY: 'k', MEDIA_URL }, PLAN, '["a"]');
    expect(synced).toEqual([{ documents: [{ document: PLAN, images: [] }] }]);
    refuse = true;
    await expect(forgetImageRefs({ MEDIA_KEY: 'k', MEDIA_URL }, PLAN, '["a"]')).rejects.toThrow();
  });

  it('is cleared at the service by the room’s purge, which goes on when the service fails', async () => {
    const { open } = planNamespace(() => ({ MEDIA_KEY: 'k', MEDIA_URL }) as Env);
    const room = open(PLAN);
    await room.room.grantImage(PLAN, 'x');
    room.db.prepare('INSERT INTO media_refs (plan_id, images) VALUES (?, ?)').run(PLAN, '["x"]');
    await room.room.purge(PLAN);
    expect(synced).toEqual([{ documents: [{ document: PLAN, images: [] }] }]);
    const again = open('plan-2');
    await again.room.grantImage('plan-2', 'y');
    again.db
      .prepare('INSERT INTO media_refs (plan_id, images) VALUES (?, ?)')
      .run('plan-2', '["y"]');
    refuse = true;
    await expect(again.room.purge('plan-2')).resolves.toBeUndefined();
  });
});
