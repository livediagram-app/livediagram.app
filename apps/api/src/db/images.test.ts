import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkDocumentTab } from './legacy-test-schema';
import { migrateFrom } from '../test-sqlite-d1';
import { resetImageRefIndexMemo } from './image-refs';
import { documentReferencesImage, imageUsageByOwner } from './images';
import { upsertTab } from './tabs';
import { liveDoc, refsFor, setup, tabWith } from './test-image-fixtures';

// The usage map and the share-visitor read (docs/specs/009-elements/images.md,
// "Reference index"): both answer from the index, never a tab body.

afterEach(() => {
  resetImageRefIndexMemo();
  vi.restoreAllMocks();
});

describe('imageUsageByOwner', () => {
  it("maps each image to the owner's diagrams that place it, once each, by name", async () => {
    const db = setup();
    liveDoc(db.sql, 'A', 'owner', 'Zebra');
    liveDoc(db.sql, 'B', 'owner', 'Apple');
    liveDoc(db.sql, 'C', 'other', 'Theirs');
    await upsertTab(db.env, 'A', tabWith('t1', 'shared-img', 'a-only'), 0);
    await upsertTab(db.env, 'A', tabWith('t2', 'shared-img'), 1);
    await upsertTab(db.env, 'B', tabWith('t3', 'shared-img'), 0);
    await upsertTab(db.env, 'C', tabWith('t4', 'a-only'), 0);
    expect(await imageUsageByOwner(db.env, 'owner')).toEqual({
      'shared-img': [
        { id: 'B', name: 'Apple' },
        { id: 'A', name: 'Zebra' },
      ],
      'a-only': [{ id: 'A', name: 'Zebra' }],
    });
  });

  it('reads the index, never a body, once the index is complete', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    await upsertTab(db.env, 'A', tabWith('t1', 'img'), 0);
    db.sql.exec('DELETE FROM image_refs');
    expect(await imageUsageByOwner(db.env, 'owner')).toEqual({});
  });

  it("indexes the owner's tabs first while the backfill is incomplete", async () => {
    const db = setup({ before0050: true });
    liveDoc(db.sql, 'A');
    db.sql.exec(
      `INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 't1', '${JSON.stringify(tabWith('t1', 'img'))}', 0)`,
    );
    linkDocumentTab(db.sql, 'A', 't1');
    migrateFrom(db.sql, '0050');
    expect(await imageUsageByOwner(db.env, 'owner')).toEqual({ img: [{ id: 'A', name: 'A' }] });
    expect(refsFor(db.sql, 'img')).toBe(1);
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped visitor
// may read an image only when THEIR tab uses it.
describe('documentReferencesImage', () => {
  async function twoTabs() {
    const db = setup();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    await upsertTab(db.env, 'A', tabWith('t1', 'i1'), 0);
    await upsertTab(db.env, 'A', tabWith('t2', 'i2'), 1);
    await upsertTab(db.env, 'B', tabWith('t3', 'i3'), 0);
    return db;
  }

  it('looks across every tab of the diagram by default', async () => {
    const db = await twoTabs();
    expect(await documentReferencesImage(db.env, 'A', 'i2')).toBe(true);
    expect(await documentReferencesImage(db.env, 'A', 'i3')).toBe(false);
  });

  it('looks at one tab when scoped', async () => {
    const db = await twoTabs();
    expect(await documentReferencesImage(db.env, 'A', 'i1', 't1')).toBe(true);
    expect(await documentReferencesImage(db.env, 'A', 'i2', 't1')).toBe(false);
  });

  it('answers from the index once it is complete', async () => {
    const db = await twoTabs();
    db.sql.exec('DELETE FROM image_refs');
    expect(await documentReferencesImage(db.env, 'A', 'i1')).toBe(false);
  });

  it("indexes the diagram's tabs first while the backfill is incomplete", async () => {
    const db = setup({ before0050: true });
    liveDoc(db.sql, 'A');
    db.sql.exec(
      `INSERT INTO tabs (id, name, data, updated_at) VALUES ('t1', 't1', '${JSON.stringify(tabWith('t1', 'img'))}', 0)`,
    );
    linkDocumentTab(db.sql, 'A', 't1');
    migrateFrom(db.sql, '0050');
    expect(await documentReferencesImage(db.env, 'A', 'img')).toBe(true);
  });
});
