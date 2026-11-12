// The photo session's tile helpers (session.ts, docs/specs/031-photo/blueprints/photo-engine.md "The session"):
// a mask tile to and from its stored RGBA, a picture sliced into a tile, a changed tile encoded and named, and
// which pixels a layer (or its mask) holds. Split out of session.ts, which re-exports topPixelLayer.
import type { PhotoBlobEntry } from '@livedesign/api-schema';
import {
  blobIdOf,
  PHOTO_TILE,
  parseTileKey,
  type LayerPixels,
  type Photo,
  type PhotoLayer,
  type Raster,
} from '@livedesign/photo-engine';
import type { PixelsStore } from './pixels-store';
import { photoWorkers } from './photo-worker-client';

/** The set under `key`, made when missing. */
export function setIn<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  return set;
}

export const maskId = (layerId: string) => `${layerId}#mask`;

/** A mask tile (one channel) as RGBA grey, as it is stored. */
export function maskToRgba(tile: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tile.length * 4);
  for (let i = 0; i < tile.length; i++) {
    const v = tile[i]!;
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function rgbaToMask(tile: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tile.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = tile[i * 4]!;
  return out;
}

/** The tile at `col`, `row` of a picture, sliced out of it (what lies past its edge left clear). */
export function sourceTile(pic: Raster, col: number, row: number): Uint8ClampedArray {
  const tile = new Uint8ClampedArray(PHOTO_TILE * PHOTO_TILE * 4);
  for (let y = 0; y < PHOTO_TILE; y++) {
    const py = row * PHOTO_TILE + y;
    if (py >= pic.height) break;
    const from = (py * pic.width + col * PHOTO_TILE) * 4;
    const len = Math.max(0, Math.min(PHOTO_TILE, pic.width - col * PHOTO_TILE)) * 4;
    tile.set(pic.data.subarray(from, from + len), y * PHOTO_TILE * 4);
  }
  return tile;
}

/** A changed tile's outcome in a pixel commit: a blob id (encoded off the main thread, stored and added to
 *  `entries`), '' (cleared) or null (back to the source, or nothing); undefined when the encode came back
 *  as something else. */
export async function committedTile(
  { data, cleared }: { data: Uint8ClampedArray | null; cleared: boolean },
  target: 'layer' | 'mask',
  hasSource: boolean,
  store: PixelsStore,
  entries: PhotoBlobEntry[],
): Promise<string | null | undefined> {
  if (!data) {
    // Cleared (a layer's emptied tile over a source, a mask's black) is kept as such; a
    // tile reset reads as the source, or nothing, again.
    return cleared && (hasSource || target === 'mask') ? '' : null;
  }
  if (isEmptyTile(data, target)) {
    // A transparent tile over a source must say so; a mask's white is its empty.
    return target === 'layer' && hasSource ? '' : null;
  }
  const rgba = target === 'mask' ? maskToRgba(data) : data;
  const res = await photoWorkers().run({
    kind: 'encode',
    width: PHOTO_TILE,
    height: PHOTO_TILE,
    data: new Uint8ClampedArray(rgba),
    type: 'image/png',
  }).result;
  if (res.kind !== 'encode') return undefined;
  const id = await blobIdOf(res.bytes);
  store.put(id, rgba, new Blob([res.bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }));
  entries.push({ id, type: 'image/png', bytes: res.bytes });
  return id;
}

export function pixelsOf(
  photo: Photo,
  layerId: string,
  target: 'layer' | 'mask',
): LayerPixels | undefined {
  const layer = photo.layers.find((l) => l.id === layerId);
  if (!layer) return undefined;
  if (target === 'mask') return layer.mask?.pixels;
  return layer.layerKind === 'pixel' ? layer.pixels : undefined;
}

export const colRow = (k: string): [number, number] => {
  const p = parseTileKey(k)!;
  return [p.col, p.row];
};

function isEmptyTile(data: Uint8ClampedArray, target: 'layer' | 'mask'): boolean {
  if (target === 'mask') {
    for (let i = 0; i < data.length; i++) if (data[i] !== 255) return false;
    return true;
  }
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
  return true;
}

export function topPixelLayer(photo: Photo): PhotoLayer | undefined {
  for (let i = photo.layers.length - 1; i >= 0; i--)
    if (photo.layers[i]!.layerKind === 'pixel') return photo.layers[i];
  return undefined;
}
