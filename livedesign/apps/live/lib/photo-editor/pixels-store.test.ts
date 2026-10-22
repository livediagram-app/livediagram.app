import { describe, expect, it } from 'vitest';
import { encodePngStream, PHOTO_TILE } from '@livedesign/photo-engine';
import { PixelsStore, SOURCE_CACHE_LIMIT } from './pixels-store';

const TILE_BYTES = PHOTO_TILE * PHOTO_TILE * 4;
const tile = (v: number) => new Uint8ClampedArray(TILE_BYTES).fill(v);
const noWait = async () => {};

async function png(width: number, height: number, rgba: number[]): Promise<Blob> {
  return encodePngStream(width, height, (_y, rows) => {
    const data = new Uint8ClampedArray(width * rows * 4);
    for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
    return { width, height: rows, data };
  });
}

describe('PixelsStore', () => {
  it('keeps tiles within its budget, the least recently used out first, pinned ones kept', () => {
    const store = new PixelsStore(async () => null, TILE_BYTES * 2, noWait);
    store.put('a', tile(1));
    store.put('b', tile(2));
    store.pin(['a']);
    store.put('c', tile(3));
    expect(store.peek('a')).toBeDefined();
    expect(store.peek('b')).toBeUndefined();
    expect(store.peek('c')).toBeDefined();
    expect(store.bytesUsed).toBe(TILE_BYTES * 2);
  });

  it('fetches and decodes a tile once, padding a small one to the full square', async () => {
    let fetches = 0;
    const blob = await png(2, 1, [9, 8, 7, 255]);
    const store = new PixelsStore(async () => (fetches++, blob), TILE_BYTES * 4, noWait);
    const [a, b] = await Promise.all([store.tile('t', 'x'), store.tile('t', 'x')]);
    expect(a).toBe(b);
    expect(fetches).toBe(1);
    expect([...a!.subarray(0, 8)]).toEqual([9, 8, 7, 255, 9, 8, 7, 255]);
    expect(a![8 + 3]).toBe(0);
    expect(await store.tile('t', 'x')).toBe(a);
  });

  it('answers its own blob before the upload, and retries a missing one, then gives up', async () => {
    let fetches = 0;
    const store = new PixelsStore(async () => (fetches++, null), TILE_BYTES * 4, noWait);
    store.put('own', tile(5), await png(1, 1, [1, 1, 1, 255]));
    expect(store.ownBlob('own')).toBeDefined();
    expect(await store.tile('t', 'missing')).toBeNull();
    expect(fetches).toBeGreaterThan(1);
    store.forgetOwn(['own']);
    expect(store.ownBlob('own')).toBeUndefined();
  });

  it('keeps only the most recent source pictures decoded', async () => {
    const store = new PixelsStore(async () => null, TILE_BYTES, noWait);
    const pic = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
    for (let i = 0; i <= SOURCE_CACHE_LIMIT; i++) store.putSource(`s${i}`, pic);
    // The first one is gone, so it is fetched again (and missing here).
    expect(await store.source('t', { blob: 's0', width: 1, height: 1 })).toBeNull();
    expect(await store.source('t', { blob: `s${SOURCE_CACHE_LIMIT}`, width: 1, height: 1 })).toBe(
      pic,
    );
    store.clear();
    expect(store.bytesUsed).toBe(0);
  });
});
