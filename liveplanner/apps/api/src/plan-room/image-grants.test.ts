import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { Env } from '../types';
import { IMAGE_GRANTS_MAX, IMAGE_ID_MAX, planServesImage, recordImageGrant } from './image-grants';
import { migratePlanSchema } from './plan-schema';
import { planNamespace } from './test-plan-namespace';

// Which Image field pictures a plan may serve (docs/specs/026-plan/item-types.md "Image fields"): a grant recorded on
// upload, and a card holding the id as a field value. Both, or nothing.

const PLAN = 'plan-1';
const IMAGE = '0b6f1c2e-3d4a-4b5c-8d9e-0f1a2b3c4d5e';

function store() {
  const db = new DatabaseSync(':memory:');
  const sql = nodeItemSql(db);
  migratePlanSchema((q) => sql.exec(q));
  db.prepare('INSERT INTO plan (id, saved_at, created_at) VALUES (?, 1, 1)').run(PLAN);
  let key = 0;
  const card = (fields: Record<string, unknown>) => {
    key += 1;
    db.prepare(
      `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, 'task', ?, 'a', ?, 1, 1, 1, '{}', '{}')`,
    ).run(PLAN, `card-${key}`, key, JSON.stringify(fields));
  };
  const grants = () =>
    db
      .prepare('SELECT image_id FROM card_image_grants ORDER BY created_at, image_id')
      .all()
      .map((r) => r.image_id as string);
  return { db, sql, card, grants };
}

describe('recordImageGrant', () => {
  it('records a grant once, and a second upload makes it the newest', () => {
    const { sql, grants } = store();
    recordImageGrant(sql, PLAN, 'a', 1);
    recordImageGrant(sql, PLAN, 'b', 2);
    recordImageGrant(sql, PLAN, 'a', 3);
    expect(grants()).toEqual(['b', 'a']);
  });

  it(`keeps at most IMAGE_GRANTS_MAX (${IMAGE_GRANTS_MAX}), the oldest dropped first`, () => {
    const { db, sql, grants } = store();
    const insert = db.prepare(
      'INSERT INTO card_image_grants (plan_id, image_id, created_at) VALUES (?, ?, ?)',
    );
    for (let i = 0; i < IMAGE_GRANTS_MAX; i++) insert.run(PLAN, `img-${i}`, i);
    recordImageGrant(sql, PLAN, 'newest', IMAGE_GRANTS_MAX + 1);
    const kept = grants();
    expect(kept).toHaveLength(IMAGE_GRANTS_MAX);
    expect(kept).not.toContain('img-0');
    expect(kept[0]).toBe('img-1');
    expect(kept.at(-1)).toBe('newest');
  });
});

describe('planServesImage', () => {
  it('serves a picture the plan holds a grant for and a card holds', () => {
    const { sql, card } = store();
    card({ title: 'Cover', photo: IMAGE });
    recordImageGrant(sql, PLAN, IMAGE, 1);
    expect(planServesImage(sql, PLAN, IMAGE)).toBe(true);
  });

  it('serves nothing without the grant, however many cards hold it (an id pasted in, or a copy)', () => {
    const { sql, card } = store();
    card({ photo: IMAGE });
    expect(planServesImage(sql, PLAN, IMAGE)).toBe(false);
  });

  it('serves nothing a card no longer holds, though the grant stays', () => {
    const { sql, card } = store();
    card({ photo: 'another' });
    recordImageGrant(sql, PLAN, IMAGE, 1);
    expect(planServesImage(sql, PLAN, IMAGE)).toBe(false);
  });

  it('matches a field whose value is the id itself, never the id inside other text', () => {
    const { sql, card } = store();
    recordImageGrant(sql, PLAN, IMAGE, 1);
    card({ description: `see "${IMAGE}" here`, list: [IMAGE] });
    expect(planServesImage(sql, PLAN, IMAGE)).toBe(false);
    card({ photo: IMAGE });
    expect(planServesImage(sql, PLAN, IMAGE)).toBe(true);
  });

  it("reads LIKE's own characters in an id as themselves", () => {
    const { sql, card } = store();
    recordImageGrant(sql, PLAN, 'a_%\\', 1);
    card({ photo: 'ab%\\' });
    expect(planServesImage(sql, PLAN, 'a_%\\')).toBe(false);
    card({ photo: 'a_%\\' });
    expect(planServesImage(sql, PLAN, 'a_%\\')).toBe(true);
  });

  it('answers no for an empty or overlong id without reading anything', () => {
    const { sql } = store();
    expect(planServesImage(sql, PLAN, '')).toBe(false);
    expect(planServesImage(sql, PLAN, 'x'.repeat(IMAGE_ID_MAX + 1))).toBe(false);
  });

  // The read every shared card thumbnail asks: a full plan (ITEMS_MAX, 2,000 cards with real-sized fields) whose
  // only holder is the last card, and the worst case, a granted picture no card holds (every card scanned). Measured
  // at 1.7 ms per check for both (a loaded laptop); the budget is far above that and fails only on a quadratic turn.
  it('stays cheap on a plan of 2,000 cards', () => {
    const { sql, card } = store();
    const filler = 'x'.repeat(400);
    for (let i = 0; i < 1999; i++) {
      card({ title: `Card ${i}`, description: filler, status: 'todo', photo: `img-${i}` });
    }
    card({ title: 'Last', photo: IMAGE });
    recordImageGrant(sql, PLAN, IMAGE, 1);
    recordImageGrant(sql, PLAN, 'unheld', 1);
    const runs = 20;
    let served = true;
    const ms = cpuMsOf(() => {
      for (let i = 0; i < runs; i++) {
        served &&= planServesImage(sql, PLAN, IMAGE);
        served &&= !planServesImage(sql, PLAN, 'unheld');
      }
    });
    expect(served).toBe(true);
    expect(ms / (runs * 2)).toBeLessThan(cpuBudgetMs(20));
  });
});

describe('the plan room', () => {
  const rooms = () => planNamespace(() => ({}) as Env);

  it('records a grant and answers what it serves, through its RPCs', async () => {
    const { open } = rooms();
    const plan = open(PLAN);
    await plan.room.grantImage(PLAN, IMAGE);
    expect(await plan.room.servesImage(PLAN, IMAGE)).toBe(false);
    plan.db
      .prepare(
        `INSERT INTO items (plan_id, id, type, item_key, rank, fields, rev, created_at, updated_at, created_by, updated_by)
         VALUES (?, 'c1', 'task', 1, 'a', ?, 1, 1, 1, '{}', '{}')`,
      )
      .run(PLAN, JSON.stringify({ photo: IMAGE }));
    expect(await plan.room.servesImage(PLAN, IMAGE)).toBe(true);
  });

  it('serves nothing for a plan never started, and asking does not start it', async () => {
    const { open } = rooms();
    const plan = open('never');
    expect(await plan.room.servesImage('never', IMAGE)).toBe(false);
    expect(plan.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).toEqual(
      [],
    );
  });

  it('drops its grants when the plan is purged', async () => {
    const { open } = rooms();
    const plan = open(PLAN);
    await plan.room.grantImage(PLAN, IMAGE);
    await plan.room.purge(PLAN);
    expect(await plan.room.servesImage(PLAN, IMAGE)).toBe(false);
  });
});
