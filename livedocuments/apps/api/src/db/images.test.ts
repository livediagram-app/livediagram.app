import { afterEach, describe, expect, it, vi } from 'vitest';
import { documentPlacesImage } from './image-refs';
import { imageUsageByOwner } from './images';
import { upsertTab } from './tabs';
import { images, liveDoc, setup, tabWith } from './test-image-fixtures';

// The usage map and the share-visitor read (docs/specs/009-elements/images.md,
// "Reference index"): both answer from the index, never a tab body. The usage map reads D1's document_images,
// which each document's push keeps; the placement is asked of the document itself.

afterEach(() => {
  vi.restoreAllMocks();
});

describe('imageUsageByOwner', () => {
  it("maps each image to the owner's documents that place it, once each, by name", async () => {
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

  it('reads the index, never a body', async () => {
    const db = setup();
    liveDoc(db.sql, 'A');
    await upsertTab(db.env, 'A', tabWith('t1', 'img'), 0);
    db.sql.exec('DELETE FROM image_refs');
    expect(await imageUsageByOwner(db.env, 'owner')).toEqual({});
  });
});

// docs/specs/013-workspace/tab-scoped-share-links.md: a tab-scoped visitor
// may read an image only when THEIR tab uses it.
describe('documentPlacesImage (placement)', () => {
  async function twoTabs() {
    const db = setup();
    liveDoc(db.sql, 'A');
    liveDoc(db.sql, 'B');
    images(db.sql, 'i1', 'i2', 'i3');
    await upsertTab(db.env, 'A', tabWith('t1', 'i1'), 0);
    await upsertTab(db.env, 'A', tabWith('t2', 'i2'), 1);
    await upsertTab(db.env, 'B', tabWith('t3', 'i3'), 0);
    return db;
  }

  it('looks across every tab of the document by default', async () => {
    const db = await twoTabs();
    expect(await documentPlacesImage(db.env, 'A', 'i2')).toBe(true);
    expect(await documentPlacesImage(db.env, 'A', 'i3')).toBe(false);
  });

  it('looks at one tab when scoped', async () => {
    const db = await twoTabs();
    expect(await documentPlacesImage(db.env, 'A', 'i1', 't1')).toBe(true);
    expect(await documentPlacesImage(db.env, 'A', 'i2', 't1')).toBe(false);
  });

  it('answers from the index', async () => {
    const db = await twoTabs();
    db.sql.exec('DELETE FROM image_refs');
    expect(await documentPlacesImage(db.env, 'A', 'i1')).toBe(false);
  });
});
