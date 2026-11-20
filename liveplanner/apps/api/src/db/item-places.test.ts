import { describe, expect, it } from 'vitest';
import { itemStatus, rankForPlace, type Item } from '@liveplanner/items';
import { sqliteD1 } from '../test-sqlite-d1';
import { insertItems, listItemPlaces, listItems } from './items';

// A write that only places a card among the others (a create, a move) reads every card's place, never its fields
// (docs/specs/026-plan/blueprints/item-store.md): the places must rank exactly as the whole cards do.

const T0 = 1_700_000_000_000;
const PERSON = { id: 'p1', name: 'Ali', color: '#ff0000' };

const item = (id: string, key: number, rank: string, fields: Item['fields']): Item => ({
  id,
  type: 'task',
  key,
  rank,
  fields,
  rev: 1,
  createdAt: T0,
  updatedAt: T0,
  createdBy: PERSON,
  updatedBy: PERSON,
});

async function plan(items: Item[]) {
  const db = sqliteD1();
  db.sql
    .prepare(
      'INSERT INTO test_plans (id, owner_id, name, saved_at, created_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run('d1', 'owner', 'Plan', T0, T0);
  await insertItems(db.env, 'd1', items);
  return db;
}

const byId = <T extends { id: string }>(list: T[]) =>
  [...list].sort((a, b) => a.id.localeCompare(b.id));

describe('listItemPlaces', () => {
  it("answers each card's id, key, rank and status, as the whole read ranks it", async () => {
    const db = await plan([
      item('a', 1, 'b', { title: 'A', status: 'todo', description: 'x'.repeat(500) }),
      item('b', 2, 'a', { title: 'B', status: 'todo' }),
      item('c', 3, 'c', { title: 'C', status: 'done' }),
      // No status, and a status that is no text: both read as none.
      item('d', 4, 'd', { title: 'D' }),
      item('e', 5, 'e', { title: 'E', status: 7 }),
    ]);
    const places = byId(await listItemPlaces(db.env, 'd1'));
    const whole = byId(await listItems(db.env, 'd1'));
    expect(places.map((p) => [p.id, p.key, p.rank, itemStatus(p)])).toEqual(
      whole.map((w) => [w.id, w.key, w.rank, itemStatus(w)]),
    );
    expect(places.map((p) => Object.keys(p.fields))).toEqual([
      ['status'],
      ['status'],
      ['status'],
      [],
      [],
    ]);
    for (const place of [
      { status: 'todo' },
      { status: 'todo', after: 'b' },
      { status: 'todo', before: 'b' },
      { status: undefined },
    ])
      expect(rankForPlace(places, place)).toBe(rankForPlace(whole, place));
  });

  it('answers nothing for a plan with no cards', async () => {
    const db = await plan([]);
    expect(await listItemPlaces(db.env, 'd1')).toEqual([]);
  });
});
