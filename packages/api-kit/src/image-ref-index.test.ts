import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createImageRefReaders, createImageRefWriters } from './image-ref-index';
import { sqliteD1 } from './testing/sqlite-d1';

// The reference index's SQL against a real SQLite, with the two tables every api that reads it has.
const SCHEMA = `
CREATE TABLE item_tabs (item_id TEXT NOT NULL, tab_id TEXT NOT NULL PRIMARY KEY);
CREATE TABLE image_refs (tab_id TEXT NOT NULL, image_id TEXT NOT NULL, PRIMARY KEY (tab_id, image_id));
`;

type Env = { DB: D1Database };
let env: Env;
const db = (e: Env) => e.DB;
const writers = createImageRefWriters(db);
const readers = createImageRefReaders(db, { table: 'item_tabs', item: 'item_id' });
const run = (statements: D1PreparedStatement[]) => env.DB.batch(statements);

beforeEach(() => {
  const dir = mkdtempSync(join(tmpdir(), 'image-ref-index-'));
  writeFileSync(join(dir, '0001_init.sql'), SCHEMA);
  const { db: d1, raw } = sqliteD1(dir);
  raw.exec(`INSERT INTO item_tabs VALUES ('doc', 't1'), ('doc', 't2'), ('other', 't3')`);
  env = { DB: d1 };
});

describe('image reference index', () => {
  it('replaces a tab’s references with the body’s, keeping the other tabs’', async () => {
    await run(writers.imageRefReplaceStatements(env, 't1', ['a', 'b']));
    await run(writers.imageRefAddStatements(env, 't2', ['b', 'c']));
    await run(writers.imageRefReplaceStatements(env, 't1', ['b']));
    expect(await readers.itemImageIds(env, 'doc')).toEqual(['b', 'c']);
    await run(writers.imageRefReplaceStatements(env, 't1', []));
    expect(await readers.itemImageIds(env, 'doc')).toEqual(['b', 'c']);
  });

  it('adds nothing for no ids, and prunes a tab whole', async () => {
    expect(writers.imageRefAddStatements(env, 't1', [])).toEqual([]);
    await run(writers.imageRefAddStatements(env, 't1', ['a', 'a']));
    expect(await readers.itemImageIds(env, 'doc')).toEqual(['a']);
    await run([writers.imageRefPruneTabStatement(env, 't1')]);
    expect(await readers.itemImageIds(env, 'doc')).toEqual([]);
  });

  it('answers whether an item places an image, on one tab when asked', async () => {
    await run(writers.imageRefAddStatements(env, 't2', ['a']));
    await run(writers.imageRefAddStatements(env, 't3', ['z']));
    expect(await readers.itemPlacesImage(env, 'doc', 'a')).toBe(true);
    expect(await readers.itemPlacesImage(env, 'doc', 'a', 't2')).toBe(true);
    expect(await readers.itemPlacesImage(env, 'doc', 'a', 't1')).toBe(false);
    expect(await readers.itemPlacesImage(env, 'doc', 'z')).toBe(false);
  });
});
