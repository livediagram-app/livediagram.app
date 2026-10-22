// Ids of a photo's parts (docs/specs/031-photo/photo-layers.md "A layer", photo-store.md "Domain
// language"): layer ids, blob ids and tile keys.
import { PHOTO_MAX_TILES_PER_SIDE } from './limits';
import type { BlobId, TileKey } from './types';

const LAYER_ID = /^ly-[0-9a-f]{8}$/;
const BLOB_ID = /^[A-Za-z0-9_-]{22}$/;
const TILE_KEY = /^(-?\d{1,3})\.(-?\d{1,3})$/;
// How far past the photo a layer's tiles may reach, in tiles, either way: a moved layer keeps its
// pixels off the photo's edges.
const TILE_REACH = PHOTO_MAX_TILES_PER_SIDE * 2;

export function isLayerId(v: unknown): v is string {
  return typeof v === 'string' && LAYER_ID.test(v);
}

export function isBlobId(v: unknown): v is BlobId {
  return typeof v === 'string' && BLOB_ID.test(v);
}

/** A new layer id, never one in `taken`. */
export function newLayerId(taken: Iterable<string> = []): string {
  const used = new Set(taken);
  let id: string;
  do id = `ly-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  while (used.has(id));
  return id;
}

export function tileKey(col: number, row: number): TileKey {
  return `${col}.${row}`;
}

/** A tile key's column and row, or undefined when it is not one (or is out of reach). */
export function parseTileKey(key: string): { col: number; row: number } | undefined {
  const m = TILE_KEY.exec(key);
  if (!m) return undefined;
  const col = Number(m[1]);
  const row = Number(m[2]);
  if (Math.abs(col) > TILE_REACH || Math.abs(row) > TILE_REACH) return undefined;
  return { col, row };
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A blob's id: the first 16 bytes of the SHA-256 of its bytes, base64url. */
export async function blobIdOf(bytes: Uint8Array | ArrayBuffer): Promise<BlobId> {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', view as BufferSource));
  return base64url(digest.subarray(0, 16));
}
