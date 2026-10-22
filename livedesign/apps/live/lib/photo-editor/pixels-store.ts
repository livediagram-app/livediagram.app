// Pixels in memory (docs/specs/031-photo/blueprints/photo-engine.md "Pixels in memory"): decoded tiles
// by blob id, within a budget (least recently used first out), pinned while a step of the undo history
// names them; and decoded sources, sliced into tiles as they are asked for. Loads are deduped, and a
// blob not uploaded yet is asked again after 1, 2, 4 and 8 seconds.
import { PHOTO_TILE, type PixelSource, type Raster } from '@livedesign/photo-engine';
import { fetchBlob, type PhotoBlobScope } from './blob-client';
import { photoWorkers } from './photo-worker-client';

export const TILE_CACHE_BYTES_DESKTOP = 512 * 1024 * 1024;
export const TILE_CACHE_BYTES_COARSE = 128 * 1024 * 1024;
// Whole source pictures kept decoded, the most recently used: each up to 8192 px a side (256 MiB),
// so a few, not every picture a long session opened.
export const SOURCE_CACHE_LIMIT = 4;
const MISSING_RETRIES_MS = [1000, 2000, 4000, 8000];

export type BlobFetcher = (tabId: string, id: string) => Promise<Blob | null>;

export function apiFetcher(scope: () => PhotoBlobScope): BlobFetcher {
  return (tabId, id) => fetchBlob(scope(), tabId, id);
}

type Entry = { data: Uint8ClampedArray; bytes: number };

export class PixelsStore {
  private readonly tiles = new Map<string, Entry>();
  private readonly sources = new Map<string, Raster>();
  private readonly loading = new Map<string, Promise<Uint8ClampedArray | null>>();
  private readonly sourceLoading = new Map<string, Promise<Raster | null>>();
  private pinned = new Set<string>();
  private used = 0;
  private readonly budget: number;
  private readonly fetcher: BlobFetcher;
  private readonly wait: (ms: number) => Promise<void>;
  // Blobs this session made itself, kept until the store has them (they may not be uploaded yet).
  private readonly own = new Map<string, Blob>();

  constructor(
    fetcher: BlobFetcher,
    budget: number = coarsePointer() ? TILE_CACHE_BYTES_COARSE : TILE_CACHE_BYTES_DESKTOP,
    wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.fetcher = fetcher;
    this.budget = budget;
    this.wait = wait;
  }

  get bytesUsed(): number {
    return this.used;
  }

  /** The blobs a step of the undo history names: never evicted while pinned. */
  pin(ids: Iterable<string>): void {
    this.pinned = new Set(ids);
  }

  /** A tile this session just made: in memory at once, its bytes kept for a fetch that comes before the upload. */
  put(id: string, data: Uint8ClampedArray, encoded?: Blob): void {
    this.remember(id, data);
    if (encoded) this.own.set(id, encoded);
  }

  /** The bytes of a blob this session made (for a re-upload), if it still has them. */
  ownBlob(id: string): Blob | undefined {
    return this.own.get(id);
  }

  peek(id: string): Uint8ClampedArray | undefined {
    const e = this.tiles.get(id);
    if (!e) return undefined;
    // Touch: the most recently used last.
    this.tiles.delete(id);
    this.tiles.set(id, e);
    return e.data;
  }

  private remember(id: string, data: Uint8ClampedArray): void {
    const prev = this.tiles.get(id);
    if (prev) this.used -= prev.bytes;
    this.tiles.delete(id);
    this.tiles.set(id, { data, bytes: data.byteLength });
    this.used += data.byteLength;
    for (const [key, e] of this.tiles) {
      if (this.used <= this.budget) break;
      if (this.pinned.has(key) || key === id) continue;
      this.tiles.delete(key);
      this.used -= e.bytes;
    }
  }

  private async fetchWithRetry(tabId: string, id: string): Promise<Blob | null> {
    const own = this.own.get(id);
    if (own) return own;
    for (let i = 0; ; i++) {
      const blob = await this.fetcher(tabId, id);
      if (blob) return blob;
      const delay = MISSING_RETRIES_MS[i];
      if (delay === undefined) {
        console.warn('[photo] tile-missing', { tabId, id });
        return null;
      }
      await this.wait(delay);
    }
  }

  /** A tile's pixels (512 x 512 RGBA, or a mask's grey in R), decoded once. */
  tile(tabId: string, id: string): Promise<Uint8ClampedArray | null> {
    const hit = this.peek(id);
    if (hit) return Promise.resolve(hit);
    const inFlight = this.loading.get(id);
    if (inFlight) return inFlight;
    const p = (async () => {
      try {
        const blob = await this.fetchWithRetry(tabId, id);
        if (!blob) return null;
        const res = await photoWorkers().run({
          kind: 'decode',
          bytes: new Uint8Array(await blob.arrayBuffer()),
          type: blob.type || 'image/png',
        }).result;
        if (res.kind !== 'decode') return null;
        const r = res.raster;
        // A tile is always the full 512 square; a smaller picture is padded with transparency.
        let data = r.data;
        if (r.width !== PHOTO_TILE || r.height !== PHOTO_TILE) {
          data = new Uint8ClampedArray(PHOTO_TILE * PHOTO_TILE * 4);
          for (let y = 0; y < Math.min(PHOTO_TILE, r.height); y++)
            data.set(
              r.data.subarray(y * r.width * 4, y * r.width * 4 + Math.min(PHOTO_TILE, r.width) * 4),
              y * PHOTO_TILE * 4,
            );
        }
        this.remember(id, data);
        return data;
      } catch (err) {
        console.warn('[photo] tile-missing', { tabId, id, error: String(err) });
        return null;
      } finally {
        this.loading.delete(id);
      }
    })();
    this.loading.set(id, p);
    return p;
  }

  /** A whole source picture, decoded once. */
  source(tabId: string, source: PixelSource): Promise<Raster | null> {
    const hit = this.sources.get(source.blob);
    if (hit) {
      this.keepSource(source.blob, hit);
      return Promise.resolve(hit);
    }
    const inFlight = this.sourceLoading.get(source.blob);
    if (inFlight) return inFlight;
    const p = (async () => {
      try {
        const blob = await this.fetchWithRetry(tabId, source.blob);
        if (!blob) return null;
        const res = await photoWorkers().run({
          kind: 'decode',
          bytes: new Uint8Array(await blob.arrayBuffer()),
          type: blob.type || 'image/jpeg',
        }).result;
        if (res.kind !== 'decode') return null;
        this.keepSource(source.blob, res.raster);
        return res.raster;
      } finally {
        this.sourceLoading.delete(source.blob);
      }
    })();
    this.sourceLoading.set(source.blob, p);
    return p;
  }

  /** A source picture made here (opened from a file): in memory at once. */
  putSource(id: string, raster: Raster, encoded?: Blob): void {
    this.keepSource(id, raster);
    if (encoded) this.own.set(id, encoded);
  }

  private keepSource(id: string, raster: Raster): void {
    this.sources.delete(id);
    this.sources.set(id, raster);
    for (const key of this.sources.keys()) {
      if (this.sources.size <= SOURCE_CACHE_LIMIT) break;
      this.sources.delete(key);
    }
  }

  /** Drops what no photo of the session names any more (its own blobs once uploaded). */
  forgetOwn(ids: Iterable<string>): void {
    for (const id of ids) this.own.delete(id);
  }

  clear(): void {
    this.tiles.clear();
    this.sources.clear();
    this.own.clear();
    this.used = 0;
  }
}

function coarsePointer(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}
