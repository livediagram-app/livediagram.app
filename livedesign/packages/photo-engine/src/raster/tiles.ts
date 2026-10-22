// A layer's or a mask's pixels in memory, as sparse 512 px tiles (docs/specs/031-photo/photo-store.md
// "Tiles"): only the tiles that hold anything exist. A pixel layer's tiles are RGBA (4 channels); a
// mask's are grey (1 channel), where a tile that does not exist reads as white (the mask shows the
// layer) unless it was cleared. Tiles are shared copy-on-write between clones, so a session can keep
// the last committed pixels next to the ones being painted without copying a whole layer.
import { tileKey } from '../model/ids';
import { PHOTO_TILE } from '../model/limits';
import type { TileKey } from '../model/types';
import { createRaster, type Raster, type Rect } from './raster';

export type Channels = 1 | 4;

export class TiledRaster {
  readonly channels: Channels;
  // What a pixel of a tile that does not exist reads as: 0 for a layer (transparent), 255 for a
  // mask (shows the layer).
  readonly empty: number;
  private tiles = new Map<TileKey, Uint8ClampedArray>();
  // Tiles this raster shares with a clone: written, they are copied first.
  private shared = new Set<TileKey>();
  // Tiles changed since the last `takeDirty`.
  private dirty = new Set<TileKey>();
  // Tiles explicitly cleared (a mask's black, a layer's erased tile over a source).
  private cleared = new Set<TileKey>();

  constructor(channels: Channels = 4, empty = 0) {
    this.channels = channels;
    this.empty = empty;
  }

  get tileBytes(): number {
    return PHOTO_TILE * PHOTO_TILE * this.channels;
  }

  keys(): TileKey[] {
    return [...this.tiles.keys()];
  }

  clearedKeys(): TileKey[] {
    return [...this.cleared];
  }

  has(col: number, row: number): boolean {
    return this.tiles.has(tileKey(col, row));
  }

  /** The tile's pixels, read-only by contract; undefined when it does not exist. */
  peek(col: number, row: number): Uint8ClampedArray | undefined {
    return this.tiles.get(tileKey(col, row));
  }

  /** The tile's pixels to write, made (filled with the empty value, or zero when cleared) or copied
   *  out of sharing first; marks it dirty. */
  writable(col: number, row: number): Uint8ClampedArray {
    const key = tileKey(col, row);
    let tile = this.tiles.get(key);
    if (!tile) {
      tile = new Uint8ClampedArray(this.tileBytes);
      const fill = this.cleared.has(key) ? 0 : this.empty;
      if (fill !== 0) tile.fill(fill);
      this.tiles.set(key, tile);
    } else if (this.shared.has(key)) {
      tile = new Uint8ClampedArray(tile);
      this.tiles.set(key, tile);
      this.shared.delete(key);
    }
    this.cleared.delete(key);
    this.dirty.add(key);
    return tile;
  }

  /** Puts a decoded tile in place (from the store), not dirty. The data is held shared: the store keeps one array per
   *  content id, so tiles that read the same (every white tile of a blank photo) arrive as one array, and the first
   *  write copies it rather than painting every tile that shares it. */
  load(key: TileKey, data: Uint8ClampedArray): void {
    this.tiles.set(key, data);
    this.shared.add(key);
    this.cleared.delete(key);
  }

  /** The tile dropped: it reads as cleared (zero) from now on, and is dirty. */
  clearTile(key: TileKey): void {
    this.tiles.delete(key);
    this.shared.delete(key);
    this.cleared.add(key);
    this.dirty.add(key);
  }

  /** The tile forgotten altogether: it reads as the empty value again, and is dirty. */
  resetTile(key: TileKey): void {
    this.tiles.delete(key);
    this.shared.delete(key);
    this.cleared.delete(key);
    this.dirty.add(key);
  }

  /** The tile forgotten as a stored change says (it reads as the empty value again), not dirty. */
  unload(key: TileKey): void {
    this.tiles.delete(key);
    this.shared.delete(key);
    this.cleared.delete(key);
  }

  markCleared(key: TileKey): void {
    this.tiles.delete(key);
    this.cleared.add(key);
  }

  takeDirty(): TileKey[] {
    const out = [...this.dirty];
    this.dirty.clear();
    return out;
  }

  peekDirty(): ReadonlySet<TileKey> {
    return this.dirty;
  }

  /** A copy sharing every tile until either side writes it. */
  clone(): TiledRaster {
    const c = new TiledRaster(this.channels, this.empty);
    for (const [k, t] of this.tiles) {
      c.tiles.set(k, t);
      c.shared.add(k);
      this.shared.add(k);
    }
    for (const k of this.cleared) c.cleared.add(k);
    return c;
  }

  /** The value of one channel of one pixel, at layer coordinates. */
  sample(x: number, y: number, channel = 0): number {
    const col = Math.floor(x / PHOTO_TILE);
    const row = Math.floor(y / PHOTO_TILE);
    const key = tileKey(col, row);
    const tile = this.tiles.get(key);
    if (!tile)
      return this.cleared.has(key) ? 0 : channel === 3 || this.channels === 1 ? this.empty : 0;
    const tx = x - col * PHOTO_TILE;
    const ty = y - row * PHOTO_TILE;
    return tile[(ty * PHOTO_TILE + tx) * this.channels + channel]!;
  }

  /** The rect of every existing tile, in layer coordinates (null when none). */
  tileBounds(): Rect | null {
    let minC = Infinity;
    let minR = Infinity;
    let maxC = -Infinity;
    let maxR = -Infinity;
    for (const k of this.tiles.keys()) {
      const [c, r] = k.split('.').map(Number) as [number, number];
      minC = Math.min(minC, c);
      minR = Math.min(minR, r);
      maxC = Math.max(maxC, c);
      maxR = Math.max(maxR, r);
    }
    if (minC === Infinity) return null;
    return {
      x: minC * PHOTO_TILE,
      y: minR * PHOTO_TILE,
      width: (maxC - minC + 1) * PHOTO_TILE,
      height: (maxR - minR + 1) * PHOTO_TILE,
    };
  }

  /** The exact rect of what the raster holds, in layer coordinates (null when nothing): a layer's
   *  pixels that are not transparent, a mask's that are not its empty (cleared tiles, black, whole). */
  contentBounds(): Rect | null {
    const T = PHOTO_TILE;
    const ch = this.channels;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    const take = (ax: number, ay: number, bx: number, by: number) => {
      if (ax < x0) x0 = ax;
      if (ay < y0) y0 = ay;
      if (bx > x1) x1 = bx;
      if (by > y1) y1 = by;
    };
    if (ch === 1 && this.empty !== 0)
      for (const k of this.cleared) {
        if (this.tiles.has(k)) continue;
        const [c, r] = k.split('.').map(Number) as [number, number];
        take(c * T, r * T, (c + 1) * T, (r + 1) * T);
      }
    for (const [k, tile] of this.tiles) {
      const [c, r] = k.split('.').map(Number) as [number, number];
      // A tile wholly inside what is already taken adds nothing.
      if (c * T >= x0 && r * T >= y0 && (c + 1) * T <= x1 && (r + 1) * T <= y1) continue;
      let tx0 = T;
      let ty0 = T;
      let tx1 = -1;
      let ty1 = -1;
      for (let y = 0; y < T; y++) {
        const row = y * T;
        for (let x = 0; x < T; x++) {
          const v = ch === 4 ? tile[(row + x) * 4 + 3]! : tile[row + x]!;
          if (ch === 4 ? v === 0 : v === this.empty) continue;
          if (x < tx0) tx0 = x;
          if (x > tx1) tx1 = x;
          if (y < ty0) ty0 = y;
          ty1 = y;
        }
      }
      if (tx1 >= 0) take(c * T + tx0, r * T + ty0, c * T + tx1 + 1, r * T + ty1 + 1);
    }
    return x1 === -Infinity ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }

  /** The tiles a rect (layer coordinates) touches, as [col, row]. */
  static tilesIn(rect: Rect): [number, number][] {
    const out: [number, number][] = [];
    if (rect.width <= 0 || rect.height <= 0) return out;
    const c0 = Math.floor(rect.x / PHOTO_TILE);
    const r0 = Math.floor(rect.y / PHOTO_TILE);
    const c1 = Math.floor((rect.x + rect.width - 1) / PHOTO_TILE);
    const r1 = Math.floor((rect.y + rect.height - 1) / PHOTO_TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c, r]);
    return out;
  }

  /** The pixels in `rect` (layer coordinates) as an RGBA raster; a mask's grey spread to RGB with
   *  alpha 255. */
  read(rect: Rect): Raster {
    const out = createRaster(rect.width, rect.height);
    const d = out.data;
    const T = PHOTO_TILE;
    for (const [col, row] of TiledRaster.tilesIn(rect)) {
      const key = tileKey(col, row);
      const tile = this.tiles.get(key);
      const fill = this.cleared.has(key) ? 0 : this.empty;
      const tx0 = Math.max(rect.x, col * T);
      const ty0 = Math.max(rect.y, row * T);
      const tx1 = Math.min(rect.x + rect.width, (col + 1) * T);
      const ty1 = Math.min(rect.y + rect.height, (row + 1) * T);
      for (let y = ty0; y < ty1; y++) {
        const o = ((y - rect.y) * rect.width + (tx0 - rect.x)) * 4;
        if (this.channels === 4) {
          if (!tile) continue; // layers' empty is transparent zeros already
          const s = ((y - row * T) * T + (tx0 - col * T)) * 4;
          d.set(tile.subarray(s, s + (tx1 - tx0) * 4), o);
        } else {
          for (let x = tx0, i = o; x < tx1; x++, i += 4) {
            const v = tile ? tile[(y - row * T) * T + (x - col * T)]! : fill;
            d[i] = v;
            d[i + 1] = v;
            d[i + 2] = v;
            d[i + 3] = 255;
          }
        }
      }
    }
    return out;
  }

  /** One channel of `rect` as bytes (a mask's grey, or a layer's alpha). */
  readChannel(rect: Rect, channel = 0): Uint8Array {
    const out = new Uint8Array(rect.width * rect.height);
    const T = PHOTO_TILE;
    const ch = this.channels;
    for (const [col, row] of TiledRaster.tilesIn(rect)) {
      const key = tileKey(col, row);
      const tile = this.tiles.get(key);
      const fill = this.cleared.has(key) ? 0 : ch === 1 ? this.empty : 0;
      const tx0 = Math.max(rect.x, col * T);
      const ty0 = Math.max(rect.y, row * T);
      const tx1 = Math.min(rect.x + rect.width, (col + 1) * T);
      const ty1 = Math.min(rect.y + rect.height, (row + 1) * T);
      for (let y = ty0; y < ty1; y++) {
        let o = (y - rect.y) * rect.width + (tx0 - rect.x);
        if (!tile) {
          if (fill !== 0) out.fill(fill, o, o + (tx1 - tx0));
          continue;
        }
        let s = ((y - row * T) * T + (tx0 - col * T)) * ch + (ch === 1 ? 0 : channel);
        for (let x = tx0; x < tx1; x++, o++, s += ch) out[o] = tile[s]!;
      }
    }
    return out;
  }

  /** `src` written at (x, y) (layer coordinates), replacing what was there; RGBA for a layer, its
   *  red channel for a mask. Fully transparent tiles written are kept (the commit drops them). */
  write(src: Raster, x: number, y: number): void {
    const rect = { x, y, width: src.width, height: src.height };
    const T = PHOTO_TILE;
    const ch = this.channels;
    for (const [col, row] of TiledRaster.tilesIn(rect)) {
      const tile = this.writable(col, row);
      const tx0 = Math.max(x, col * T);
      const ty0 = Math.max(y, row * T);
      const tx1 = Math.min(x + src.width, (col + 1) * T);
      const ty1 = Math.min(y + src.height, (row + 1) * T);
      for (let py = ty0; py < ty1; py++) {
        const s = ((py - y) * src.width + (tx0 - x)) * 4;
        if (ch === 4) {
          const o = ((py - row * T) * T + (tx0 - col * T)) * 4;
          tile.set(src.data.subarray(s, s + (tx1 - tx0) * 4), o);
        } else {
          let o = (py - row * T) * T + (tx0 - col * T);
          for (let px = tx0, i = s; px < tx1; px++, i += 4, o++) tile[o] = src.data[i]!;
        }
      }
    }
  }

  /** One channel written from bytes over `rect` (a mask's grey). */
  writeChannel(rect: Rect, values: Uint8Array): void {
    if (this.channels !== 1) throw new Error('writeChannel is for masks');
    const T = PHOTO_TILE;
    for (const [col, row] of TiledRaster.tilesIn(rect)) {
      const tile = this.writable(col, row);
      const tx0 = Math.max(rect.x, col * T);
      const ty0 = Math.max(rect.y, row * T);
      const tx1 = Math.min(rect.x + rect.width, (col + 1) * T);
      const ty1 = Math.min(rect.y + rect.height, (row + 1) * T);
      for (let py = ty0; py < ty1; py++) {
        const s = (py - rect.y) * rect.width + (tx0 - rect.x);
        const o = (py - row * T) * T + (tx0 - col * T);
        tile.set(values.subarray(s, s + (tx1 - tx0)), o);
      }
    }
  }

  /** Drops tiles that read as their empty value throughout (a layer's fully transparent tile), so
   *  they are stored as nothing. Answers the keys dropped. */
  dropEmptyTiles(): TileKey[] {
    const dropped: TileKey[] = [];
    for (const [k, t] of this.tiles) {
      let empty = true;
      if (this.channels === 4) {
        for (let i = 3; i < t.length; i += 4)
          if (t[i] !== 0) {
            empty = false;
            break;
          }
      } else {
        const v = this.empty;
        for (let i = 0; i < t.length; i++)
          if (t[i] !== v) {
            empty = false;
            break;
          }
      }
      if (empty) dropped.push(k);
    }
    for (const k of dropped) {
      this.tiles.delete(k);
      this.shared.delete(k);
    }
    return dropped;
  }

  /** The bytes this raster holds that no clone shares. */
  ownBytes(): number {
    let n = 0;
    for (const k of this.tiles.keys()) if (!this.shared.has(k)) n += this.tileBytes;
    return n;
  }

  /** A raster from a picture placed at (x, y) in layer coordinates. */
  static fromRaster(src: Raster, x = 0, y = 0): TiledRaster {
    const t = new TiledRaster(4, 0);
    t.write(src, x, y);
    t.dropEmptyTiles();
    t.takeDirty();
    return t;
  }
}
