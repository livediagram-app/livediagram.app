import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { ATTENDANCE_REJOIN_GRACE_MS, ATTENDANCE_TAB_MAX } from '@livehuddle/api-schema';
import { VISIT_PEOPLE_MAX } from '@livehuddle/document/automations';
import { nodeItemSql } from '@liveworkspace/index-app/testing';
import { migrateDocumentSchema } from '../document-schema';
import { stretchOf, tabOccupied } from './visit-events';

// The stretch Everyone Left reads (blueprint automations.md "Event call sites"): who kept the tab occupied until the
// last one left, how many, and for how long, with gaps under the rejoin grace carried over.

const MIN = 60_000;
let db: DatabaseSync;
let sql: ReturnType<typeof nodeItemSql>;

const visit = (person: string, joined: number, left: number | null, tab = 't1', name = person) =>
  db
    .prepare(
      `INSERT INTO tab_attendance (tab_id, person_key, name, color, picture, guest, joined_at, left_at, closed_at, seen_at)
       VALUES (?, ?, ?, '#123456', NULL, 1, ?, ?, ?, ?)`,
    )
    .run(tab, person, name, joined, left, left, left ?? joined);

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  sql = nodeItemSql(db);
  migrateDocumentSchema((q) => sql.exec(q));
});

describe('stretchOf', () => {
  it('names the people in the order they came, once each, and counts them', () => {
    visit('ben', 5 * MIN, 30 * MIN, 't1', 'Ben');
    visit('ana', 0, 20 * MIN, 't1', 'Ana');
    visit('ben', 31 * MIN, 40 * MIN, 't1', 'Ben');
    // Another tab is not this one's company.
    visit('cy', 0, 50 * MIN, 't2', 'Cy');
    expect(stretchOf(sql, 't1')).toEqual({ people: 'Ana, Ben', count: 2, minutes: 40 });
  });

  it('carries over a gap inside the rejoin grace, and stops at a longer one', () => {
    visit('old', 0, 10 * MIN, 't1', 'Old');
    // Empty for longer than the grace: that was another stretch.
    const start = 10 * MIN + ATTENDANCE_REJOIN_GRACE_MS + MIN;
    visit('ana', start, start + 5 * MIN, 't1', 'Ana');
    // Back within the grace of Ana's start: the same stretch.
    visit('ben', start + 5 * MIN + ATTENDANCE_REJOIN_GRACE_MS - 1, start + 9 * MIN, 't1', 'Ben');
    expect(stretchOf(sql, 't1')).toEqual({ people: 'Ana, Ben', count: 2, minutes: 9 });
  });

  it(`names at most ${VISIT_PEOPLE_MAX} people and counts them all`, () => {
    for (let i = 0; i < VISIT_PEOPLE_MAX + 5; i += 1) visit(`p${i}`, i, 60 * MIN, 't1', `P${i}`);
    const stretch = stretchOf(sql, 't1');
    expect(stretch.people.split(', ')).toHaveLength(VISIT_PEOPLE_MAX);
    expect(stretch.people.startsWith('P0, P1')).toBe(true);
    expect(stretch.count).toBe(VISIT_PEOPLE_MAX + 5);
    expect(stretch.minutes).toBe(60);
  });

  it(`reads at most ${ATTENDANCE_TAB_MAX} visits, and answers nobody for a tab with none`, () => {
    for (let i = 0; i < ATTENDANCE_TAB_MAX + 10; i += 1) visit(`p${i}`, 0, MIN + i, 't1');
    expect(stretchOf(sql, 't1').count).toBe(ATTENDANCE_TAB_MAX);
    expect(stretchOf(sql, 't2')).toEqual({ people: '', count: 0, minutes: 0 });
  });
});

describe('tabOccupied', () => {
  it('is true while a visit is open', () => {
    visit('ana', 0, 10 * MIN);
    expect(tabOccupied(sql, 't1')).toBe(false);
    visit('ben', 0, null);
    expect(tabOccupied(sql, 't1')).toBe(true);
    expect(tabOccupied(sql, 't2')).toBe(false);
  });
});
