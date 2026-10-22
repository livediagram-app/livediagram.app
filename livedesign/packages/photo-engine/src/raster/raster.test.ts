import { describe, expect, it } from 'vitest';
import { PHOTO_TILE } from '../model/limits';
import {
  combineMasks,
  createMask,
  invertMask,
  maskAt,
  maskBounds,
  maskOver,
  maskRect,
  selectedCount,
  trimMask,
} from './mask';
import {
  alphaBounds,
  cloneRaster,
  copyInto,
  createRaster,
  cropRaster,
  intersectRects,
  isTransparent,
  pixelAt,
  setPixel,
  solidRaster,
  unionRects,
} from './raster';
import { TiledRaster } from './tiles';

describe('raster', () => {
  it('reads, writes and copies pixels', () => {
    const r = createRaster(4, 3);
    setPixel(r, 1, 2, [1, 2, 3, 4]);
    setPixel(r, 9, 9, [1, 1, 1]);
    expect(pixelAt(r, 1, 2)).toEqual([1, 2, 3, 4]);
    expect(pixelAt(r, -1, 0)).toEqual([0, 0, 0, 0]);
    const c = cloneRaster(r);
    c.data[0] = 9;
    expect(r.data[0]).toBe(0);
    const s = solidRaster(2, 2, [5, 6, 7]);
    expect(pixelAt(s, 1, 1)).toEqual([5, 6, 7, 255]);
    const big = createRaster(4, 4);
    copyInto(s, big, 0, 0, 3, 3, 2, 2);
    expect(pixelAt(big, 3, 3)).toEqual([5, 6, 7, 255]);
    expect(pixelAt(big, 2, 2)).toEqual([0, 0, 0, 0]);
    copyInto(s, big, 0, 0, 10, 10, 2, 2);
    const crop = cropRaster(big, { x: 2, y: 2, width: 3, height: 3 });
    expect(pixelAt(crop, 1, 1)).toEqual([5, 6, 7, 255]);
    expect(pixelAt(crop, 2, 2)).toEqual([0, 0, 0, 0]);
  });

  it('finds alpha bounds and transparency', () => {
    const r = createRaster(5, 5);
    expect(alphaBounds(r)).toBeNull();
    expect(isTransparent(r.data)).toBe(true);
    setPixel(r, 1, 2, [0, 0, 0, 1]);
    setPixel(r, 3, 3, [0, 0, 0, 1]);
    expect(alphaBounds(r)).toEqual({ x: 1, y: 2, width: 3, height: 2 });
    expect(isTransparent(r.data)).toBe(false);
  });

  it('intersects and unites rects', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    expect(intersectRects(a, b)).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    expect(intersectRects(a, { x: 20, y: 0, width: 1, height: 1 })).toBeNull();
    expect(unionRects(a, b)).toEqual({ x: 0, y: 0, width: 15, height: 15 });
    expect(unionRects(null, b)).toBe(b);
    expect(unionRects(a, null)).toBe(a);
  });
});

describe('TiledRaster', () => {
  const T = PHOTO_TILE;

  it('copies a loaded tile before writing it, so tiles loaded from one array stay apart', () => {
    // The store hands every tile with the same content one array (a blank photo's white tiles).
    const white = new Uint8ClampedArray(T * T * 4).fill(255);
    const t = new TiledRaster();
    t.load('0.0', white);
    t.load('1.0', white);
    t.write(solidRaster(4, 4, [10, 20, 30, 255]), 0, 0);
    expect(t.sample(0, 0, 0)).toBe(10);
    expect(t.sample(T, 0, 0)).toBe(255);
    expect(white[0]).toBe(255);
  });

  it('writes across tiles and reads back, empty tiles transparent', () => {
    const t = new TiledRaster();
    const src = solidRaster(10, 10, [200, 100, 50, 255]);
    t.write(src, T - 5, T - 5);
    expect(t.keys().sort()).toEqual(['0.0', '0.1', '1.0', '1.1']);
    const back = t.read({ x: T - 6, y: T - 6, width: 12, height: 12 });
    expect(pixelAt(back, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(back, 1, 1)).toEqual([200, 100, 50, 255]);
    expect(pixelAt(back, 10, 10)).toEqual([200, 100, 50, 255]);
    expect(pixelAt(back, 11, 11)).toEqual([0, 0, 0, 0]);
    expect(t.sample(T, T, 0)).toBe(200);
    expect(t.sample(T * 5, 0, 3)).toBe(0);
    expect(t.tileBounds()).toEqual({ x: 0, y: 0, width: 2 * T, height: 2 * T });
    // The exact extent: what the pixels cover, not the tiles.
    expect(t.contentBounds()).toEqual({ x: T - 5, y: T - 5, width: 10, height: 10 });
    expect(t.takeDirty().sort()).toEqual(['0.0', '0.1', '1.0', '1.1']);
    expect(t.takeDirty()).toEqual([]);
  });

  it('bounds a mask by what is not its white, cleared tiles whole', () => {
    const m = new TiledRaster(1, 255);
    expect(m.contentBounds()).toBeNull();
    m.write(solidRaster(1, 1, [0, 0, 0, 255]), 3, 4);
    expect(m.contentBounds()).toEqual({ x: 3, y: 4, width: 1, height: 1 });
    m.clearTile('1.0');
    expect(m.contentBounds()).toEqual({ x: 3, y: 0, width: 2 * T - 3, height: T });
    expect(new TiledRaster().contentBounds()).toBeNull();
  });

  it('handles negative tiles', () => {
    const t = new TiledRaster();
    t.write(solidRaster(2, 2, [1, 2, 3, 255]), -1, -1);
    expect(t.keys().sort()).toEqual(['-1.-1', '-1.0', '0.-1', '0.0']);
    expect(t.sample(-1, -1, 2)).toBe(3);
  });

  it('shares tiles with a clone until written', () => {
    const t = new TiledRaster();
    t.write(solidRaster(4, 4, [9, 9, 9, 255]), 0, 0);
    const c = t.clone();
    expect(c.peek(0, 0)).toBe(t.peek(0, 0));
    expect(t.ownBytes()).toBe(0);
    c.write(solidRaster(1, 1, [1, 1, 1, 255]), 0, 0);
    expect(c.peek(0, 0)).not.toBe(t.peek(0, 0));
    expect(t.sample(0, 0)).toBe(9);
    expect(c.sample(0, 0)).toBe(1);
    expect(c.ownBytes()).toBe(T * T * 4);
  });

  it('masks read white where empty and black where cleared', () => {
    const m = new TiledRaster(1, 255);
    expect(m.sample(5, 5)).toBe(255);
    m.clearTile('0.0');
    expect(m.sample(5, 5)).toBe(0);
    expect(m.clearedKeys()).toEqual(['0.0']);
    const vals = new Uint8Array(4).fill(77);
    m.writeChannel({ x: 1, y: 1, width: 2, height: 2 }, vals);
    expect(m.sample(1, 1)).toBe(77);
    // The rest of a cleared tile stays black once made.
    expect(m.sample(0, 0)).toBe(0);
    const ch = m.readChannel({ x: 0, y: 0, width: 3, height: 1 });
    expect([...ch]).toEqual([0, 0, 0]);
    const ch2 = m.readChannel({ x: T, y: 0, width: 2, height: 1 });
    expect([...ch2]).toEqual([255, 255]);
    const rgba = m.read({ x: 1, y: 1, width: 1, height: 1 });
    expect([...rgba.data]).toEqual([77, 77, 77, 255]);
    expect(() =>
      new TiledRaster().writeChannel({ x: 0, y: 0, width: 1, height: 1 }, vals),
    ).toThrow();
    m.resetTile('0.0');
    expect(m.sample(1, 1)).toBe(255);
  });

  it('unloads a tile as a stored change says, leaving what waits to be committed', () => {
    const m = new TiledRaster(1, 255);
    m.writable(0, 0).fill(9);
    m.clearTile('1.0');
    m.takeDirty();
    m.writable(2, 0);
    m.unload('0.0');
    m.unload('1.0');
    expect(m.sample(1, 1)).toBe(255);
    expect(m.sample(T + 1, 1)).toBe(255);
    expect([...m.peekDirty()]).toEqual(['2.0']);
  });

  it('reads a layer channel and drops empty tiles', () => {
    const t = new TiledRaster();
    t.write(solidRaster(2, 1, [1, 2, 3, 40]), 0, 0);
    expect([...t.readChannel({ x: 0, y: 0, width: 3, height: 1 }, 3)]).toEqual([40, 40, 0]);
    t.write(createRaster(2, 1), T * 2, 0);
    expect(t.dropEmptyTiles()).toEqual(['2.0']);
    expect(t.keys()).toEqual(['0.0']);
    const m = new TiledRaster(1, 255);
    m.writable(0, 0);
    expect(m.dropEmptyTiles()).toEqual(['0.0']);
    t.load('5.5', new Uint8ClampedArray(T * T * 4));
    expect(t.has(5, 5)).toBe(true);
    t.markCleared('5.5');
    expect(t.has(5, 5)).toBe(false);
  });

  it('builds from a raster and lists tiles in a rect', () => {
    const t = TiledRaster.fromRaster(solidRaster(3, 3, [1, 1, 1, 255]), T, 0);
    expect(t.keys()).toEqual(['1.0']);
    expect(t.peekDirty().size).toBe(0);
    expect(TiledRaster.tilesIn({ x: 0, y: 0, width: 0, height: 5 })).toEqual([]);
    expect(TiledRaster.tilesIn({ x: -1, y: 0, width: 2, height: 1 })).toEqual([
      [-1, 0],
      [0, 0],
    ]);
  });
});

describe('selection masks', () => {
  it('reads, bounds and trims', () => {
    const m = createMask({ x: 10, y: 10, width: 4, height: 4 });
    expect(maskBounds(m)).toBeNull();
    expect(trimMask(m)).toBeNull();
    m.data[5] = 200;
    expect(maskAt(m, 11, 11)).toBe(200);
    expect(maskAt(m, 0, 0)).toBe(0);
    expect(maskBounds(m)).toEqual({ x: 11, y: 11, width: 1, height: 1 });
    expect(maskRect(trimMask(m)!)).toEqual({ x: 11, y: 11, width: 1, height: 1 });
    expect(selectedCount(m)).toBe(1);
    const over = maskOver(m, { x: 0, y: 0, width: 12, height: 12 });
    expect(maskAt(over, 11, 11)).toBe(200);
  });

  it('combines by the modifiers and inverts', () => {
    const a = createMask({ x: 0, y: 0, width: 2, height: 1 }, 255);
    const b = createMask({ x: 1, y: 0, width: 2, height: 1 }, 255);
    expect(maskRect(combineMasks(a, b, 'add')!)).toEqual({ x: 0, y: 0, width: 3, height: 1 });
    expect(maskRect(combineMasks(a, b, 'intersect')!)).toEqual({ x: 1, y: 0, width: 1, height: 1 });
    expect(maskRect(combineMasks(a, b, 'subtract')!)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(maskRect(combineMasks(a, b, 'new')!)).toEqual({ x: 1, y: 0, width: 2, height: 1 });
    expect(combineMasks(null, b, 'add')).toEqual(trimMask(b));
    expect(combineMasks(null, b, 'subtract')).toBeNull();
    expect(combineMasks(null, b, 'intersect')).toBeNull();
    const inv = invertMask(a, { x: 0, y: 0, width: 3, height: 1 });
    expect([...inv.data]).toEqual([0, 0, 255]);
    expect(selectedCount(invertMask(null, { x: 0, y: 0, width: 2, height: 2 }))).toBe(4);
  });
});
