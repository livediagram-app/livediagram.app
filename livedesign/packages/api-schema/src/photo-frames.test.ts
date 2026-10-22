import { describe, expect, it } from 'vitest';
import { applyPhotoOps, type Photo, type PhotoLayer } from '@livedesign/photo-engine';
import { decodeBlobBatch, encodeBlobBatch, sniffsAs } from './photo-blob-batch';
import { tabPhotoOps } from './photo-frames';

const layer = (n: number, name = `L${n}`): PhotoLayer => ({
  id: `ly-${n.toString(16).padStart(8, '0')}`,
  name,
  layerKind: 'pixel',
  pixels: { tiles: {} },
});
const photo = (layers: PhotoLayer[]): Photo => ({ width: 10, height: 10, layers });

describe('tabPhotoOps', () => {
  it('says nothing for the same photos, and a photo gone', () => {
    const photos = { p1: photo([layer(1)]) };
    expect(tabPhotoOps({ id: 't', photos }, { id: 't', photos })).toEqual([]);
    expect(tabPhotoOps({ id: 't', photos }, { id: 't' })).toEqual([
      { kind: 'photo', tabId: 't', pageId: 'p1', removed: true },
    ]);
  });

  it('sends a changed photo’s ops, leaving an untouched one out', () => {
    const same = photo([layer(1)]);
    const before = { id: 't', photos: { a: same, b: photo([layer(2)]) } };
    const after = { id: 't', photos: { a: same, b: photo([layer(2, 'Renamed')]) } };
    const ops = tabPhotoOps(before, after);
    expect(ops).toHaveLength(1);
    const op = ops[0]!;
    if (op.kind !== 'photo' || 'removed' in op) throw new Error('ops');
    expect(op.pageId).toBe('b');
    expect(applyPhotoOps(before.photos.b, op.ops)).toEqual(after.photos.b);
  });

  it('frames a large change into several ops that compose', () => {
    const big = Array.from({ length: 300 }, (_, i) => layer(i, 'x'.repeat(50)));
    for (const l of big)
      if (l.layerKind === 'pixel')
        l.pixels = {
          tiles: Object.fromEntries(
            Array.from({ length: 120 }, (_, k) => [
              `${k % 15}.${Math.floor(k / 15)}`,
              'abcdefghijklmnopqrstuv',
            ]),
          ),
        };
    const after = { id: 't', photos: { p: photo(big) } };
    const ops = tabPhotoOps({ id: 't' }, after);
    expect(ops.length).toBeGreaterThan(1);
    let built = photo([]);
    for (const op of ops) {
      if (op.kind !== 'photo' || 'removed' in op) continue;
      expect(JSON.stringify(op).length).toBeLessThan(256_000);
      built = applyPhotoOps(built, op.ops);
    }
    expect(built.layers.map((l) => l.id)).toEqual(big.map((l) => l.id).slice(-100));
  });
});

describe('blob batches', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9]);
  it('round-trips', () => {
    const body = encodeBlobBatch([
      { id: 'abcdefghijklmnopqrstuv', type: 'image/png', bytes: png },
      { id: 'ABCDEFGHIJKLMNOPQRSTUV', type: 'image/jpeg', bytes: jpg },
    ]);
    const back = decodeBlobBatch(body);
    if (back === 'bad_batch') throw new Error('bad');
    expect(back.map((b) => [b.id, b.type, [...b.bytes]])).toEqual([
      ['abcdefghijklmnopqrstuv', 'image/png', [...png]],
      ['ABCDEFGHIJKLMNOPQRSTUV', 'image/jpeg', [...jpg]],
    ]);
  });
  it('refuses anything malformed', () => {
    const good = encodeBlobBatch([{ id: 'abcdefghijklmnopqrstuv', type: 'image/png', bytes: png }]);
    expect(decodeBlobBatch(new Uint8Array(2))).toBe('bad_batch');
    expect(decodeBlobBatch(good.slice(0, good.length - 1))).toBe('bad_batch');
    expect(decodeBlobBatch(new Uint8Array([...good, 0]))).toBe('bad_batch');
    const head = (json: string) => {
      const h = new TextEncoder().encode(json);
      const b = new Uint8Array(4 + h.length + 4);
      new DataView(b.buffer).setUint32(0, h.length);
      b.set(h, 4);
      return b;
    };
    expect(decodeBlobBatch(head('nope'))).toBe('bad_batch');
    expect(decodeBlobBatch(head('[]'))).toBe('bad_batch');
    expect(decodeBlobBatch(head('[1]'))).toBe('bad_batch');
    expect(decodeBlobBatch(head('[{"id":"short","type":"image/png","size":4}]'))).toBe('bad_batch');
    expect(
      decodeBlobBatch(head('[{"id":"abcdefghijklmnopqrstuv","type":"image/svg+xml","size":4}]')),
    ).toBe('bad_batch');
    expect(
      decodeBlobBatch(head('[{"id":"abcdefghijklmnopqrstuv","type":"image/png","size":0}]')),
    ).toBe('bad_batch');
    expect(
      decodeBlobBatch(head('[{"id":"abcdefghijklmnopqrstuv","type":"image/png","size":4}]')),
    ).not.toBe('bad_batch');
    const huge = new Uint8Array(8);
    new DataView(huge.buffer).setUint32(0, 1 << 30);
    expect(decodeBlobBatch(huge)).toBe('bad_batch');
  });
  it('sniffs magic numbers', () => {
    expect(sniffsAs(png, 'image/png')).toBe(true);
    expect(sniffsAs(jpg, 'image/png')).toBe(false);
    expect(sniffsAs(jpg, 'image/jpeg')).toBe(true);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0]);
    expect(sniffsAs(webp, 'image/webp')).toBe(true);
    expect(sniffsAs(png, 'image/webp')).toBe(false);
  });
});
