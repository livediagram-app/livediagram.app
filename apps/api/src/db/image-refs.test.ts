import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { applyMigration, sqliteD1 } from '../test-sqlite-d1';
import { imageRefIdsFromData } from '../image-refs/extract';
import {
  imageRefIndexDiagramStatement,
  imageRefIndexOwnerStatement,
  imageRefIndexPageStatement,
  isImageRefIndexComplete,
  readImageRefsBackfill,
  resetImageRefIndexMemo,
  restartImageRefsBackfill,
} from './image-refs';

// The SQL extractor (backfill + lazy indexing) and the JavaScript one (every
// save) must agree on what a reference is (docs/specs/009-elements/images.md,
// "Reference index"): one that the SQL side misses is an image the sweep
// would reap for a tab that was only ever backfilled.

const img = (imageId: unknown, extra: Record<string, unknown> = {}) => ({
  id: 'e',
  type: 'image',
  imageId,
  ...extra,
});

// Valid JSON bodies only: a corrupt body never reaches the SQL extractor as
// data (the backfill hands it to the text scan).
const CORPUS: Record<string, unknown> = {
  plain: { elements: [img('a'), img('b')] },
  duplicate: { elements: [img('a'), img('a')] },
  placeholder: { elements: [img(null)] },
  dataUri: { elements: [img('data:image/png;base64,AAAA')] },
  empty: { elements: [img('')] },
  numeric: { elements: [img(7)] },
  atCap: { elements: [img('x'.repeat(128))] },
  overCap: { elements: [img('y'.repeat(129))] },
  escaped: { elements: [img('q"uo\\te')] },
  unicode: { elements: [img('ïmägé-ü')] },
  otherType: { elements: [{ id: 's', type: 'shape', imageId: 'no' }] },
  capitalType: { elements: [{ id: 's', type: 'Image', imageId: 'no' }] },
  nestedOnly: { elements: [{ id: 'w', type: 'banner', children: [img('nested')] }] },
  mixedEntries: { elements: [null, 'image', 3, [img('in-array')], img('ok')] },
  elementsObject: { elements: { a: img('obj') } },
  elementsMissing: { theme: 'x' },
  topLevelArray: [img('top')],
  topLevelNull: null,
  settingsImageId: { imageId: 'setting', elements: [] },
};

function tabRow(sql: DatabaseSync, id: string, data: string) {
  sql
    .prepare('INSERT INTO tabs (id, name, data, updated_at) VALUES (?, ?, ?, 0)')
    .run(id, id, data);
}

function refsByTab(sql: DatabaseSync): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const r of sql
    .prepare('SELECT tab_id, image_id FROM image_refs ORDER BY tab_id, image_id')
    .all()) {
    (out[r.tab_id as string] ??= []).push(r.image_id as string);
  }
  return out;
}

afterEach(() => resetImageRefIndexMemo());

describe('the SQL extractor', () => {
  it('finds exactly what the JavaScript extractor finds', async () => {
    const { env, sql } = sqliteD1();
    const expected: Record<string, string[]> = {};
    for (const [name, body] of Object.entries(CORPUS)) {
      const data = JSON.stringify(body);
      tabRow(sql, name, data);
      const ids = imageRefIdsFromData(data).sort();
      if (ids.length > 0) expected[name] = ids;
    }
    await imageRefIndexPageStatement(env, 0, 1_000_000).run();
    expect(refsByTab(sql)).toEqual(expected);
    // The corpus exercises both sides, not just empties.
    expect(Object.keys(expected).sort()).toEqual([
      'atCap',
      'duplicate',
      'escaped',
      'mixedEntries',
      'plain',
      'unicode',
    ]);
  });

  it('skips a corrupt body without failing the statement', async () => {
    const { env, sql } = sqliteD1();
    tabRow(sql, 'bad', '{"elements":[{"type":"image","imageId":"a"}');
    tabRow(sql, 'good', JSON.stringify({ elements: [img('b')] }));
    await imageRefIndexPageStatement(env, 0, 10).run();
    expect(refsByTab(sql)).toEqual({ good: ['b'] });
  });

  it('pages by rowid range, bounds inclusive of the upper end only', async () => {
    const { env, sql } = sqliteD1();
    for (const n of [1, 2, 3]) tabRow(sql, `t${n}`, JSON.stringify({ elements: [img(`i${n}`)] }));
    await imageRefIndexPageStatement(env, 1, 2).run();
    expect(refsByTab(sql)).toEqual({ t2: ['i2'] });
  });

  it("scopes to an owner's or a diagram's tabs", async () => {
    const { env, sql } = sqliteD1();
    for (const [d, owner] of [
      ['A', 'me'],
      ['B', 'other'],
    ]) {
      sql
        .prepare(
          'INSERT INTO diagrams (id, owner_id, name, shareable, saved_at, created_at) VALUES (?, ?, ?, 0, 0, 0)',
        )
        .run(d!, owner!, d!);
    }
    tabRow(sql, 'ta', JSON.stringify({ elements: [img('ia')] }));
    tabRow(sql, 'tb', JSON.stringify({ elements: [img('ib')] }));
    sql.exec(
      "INSERT INTO diagram_tabs (diagram_id, tab_id, order_index, added_at) VALUES ('A', 'ta', 0, 0), ('B', 'tb', 0, 0)",
    );
    await imageRefIndexOwnerStatement(env, 'me').run();
    expect(refsByTab(sql)).toEqual({ ta: ['ia'] });
    await imageRefIndexDiagramStatement(env, 'B').run();
    expect(refsByTab(sql)).toEqual({ ta: ['ia'], tb: ['ib'] });
  });
});

describe('migration 0050', () => {
  it('starts complete on a database with no tabs', async () => {
    const { env } = sqliteD1();
    expect(await readImageRefsBackfill(env)).toMatchObject({ cursor: 0 });
    expect(await isImageRefIndexComplete(env)).toBe(true);
  });

  it('starts incomplete, with nothing indexed, on a database with tabs', async () => {
    const { env, sql } = sqliteD1({}, { before: '0050' });
    tabRow(sql, 't1', JSON.stringify({ elements: [img('a')] }));
    applyMigration(sql, '0050');
    expect(await readImageRefsBackfill(env)).toMatchObject({ cursor: 0, completed_at: null });
    expect(await isImageRefIndexComplete(env)).toBe(false);
    expect(refsByTab(sql)).toEqual({});
  });
});

describe('isImageRefIndexComplete', () => {
  it('treats a missing state row as incomplete', async () => {
    const { env, sql } = sqliteD1();
    sql.exec('DELETE FROM image_refs_backfill');
    expect(await isImageRefIndexComplete(env)).toBe(false);
  });

  it('remembers completion without asking again', async () => {
    const { env, sql } = sqliteD1();
    expect(await isImageRefIndexComplete(env)).toBe(true);
    sql.exec('DELETE FROM image_refs_backfill');
    expect(await isImageRefIndexComplete(env)).toBe(true);
  });

  it('reads incomplete after a restart', async () => {
    const { env } = sqliteD1();
    await restartImageRefsBackfill(env, 5);
    expect(await readImageRefsBackfill(env)).toEqual({
      created_at: 5,
      cursor: 0,
      completed_at: null,
    });
    expect(await isImageRefIndexComplete(env)).toBe(false);
  });
});
