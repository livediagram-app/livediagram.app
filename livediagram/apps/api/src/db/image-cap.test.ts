import { describe, expect, it } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { imageTotalsByOwner, insertImage } from './images';

// The per-owner gallery cap holds even when uploads race
// (docs/specs/009-elements/images.md "Size cap"): the insert itself checks the
// totals, so N concurrent uploads that each saw room cannot all land. Proven on
// a real SQLite, where each statement is atomic as it is on D1.

const row = (id: string, byteSize = 100) => ({
  id,
  ownerId: 'owner',
  contentType: 'image/webp',
  byteSize,
  width: 10,
  height: 10,
  sha256: id.padEnd(64, '0'),
  originalName: null,
});

describe('insertImage with caps', () => {
  it('inserts while under both caps', async () => {
    const db = sqliteD1();
    const image = await insertImage(db.env, row('a'), { maxImages: 2, maxBytes: 1000 });
    expect(image?.id).toBe('a');
    expect(await imageTotalsByOwner(db.env, 'owner')).toEqual({ count: 1, bytes: 100 });
  });

  it('refuses the insert that would pass the image-count cap, even when racing', async () => {
    const db = sqliteD1();
    const caps = { maxImages: 3, maxBytes: null };
    const results = await Promise.all(
      ['a', 'b', 'c', 'd', 'e'].map((id) => insertImage(db.env, row(id), caps)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    expect((await imageTotalsByOwner(db.env, 'owner')).count).toBe(3);
  });

  it('refuses the insert that would pass the byte cap', async () => {
    const db = sqliteD1();
    const caps = { maxImages: null, maxBytes: 250 };
    expect(await insertImage(db.env, row('a', 200), caps)).not.toBeNull();
    expect(await insertImage(db.env, row('b', 100), caps)).toBeNull();
    expect(await insertImage(db.env, row('c', 50), caps)).not.toBeNull();
  });

  it('counts only the owner’s own images', async () => {
    const db = sqliteD1();
    await insertImage(db.env, { ...row('x'), ownerId: 'other' }, { maxImages: 1, maxBytes: null });
    expect(await insertImage(db.env, row('a'), { maxImages: 1, maxBytes: null })).not.toBeNull();
  });

  it('inserts without limit when no cap is set (self-host default)', async () => {
    const db = sqliteD1();
    for (const id of ['a', 'b', 'c']) {
      expect(
        await insertImage(db.env, row(id), { maxImages: null, maxBytes: null }),
      ).not.toBeNull();
    }
  });
});
