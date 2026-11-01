// One person's editing of one photo page (docs/specs/031-photo/blueprints/photo-engine.md "The
// session"): the photo as last committed, every layer's and mask's pixels loaded from their tiles, the
// active layer and target, the selection, and what changed since the last commit. It follows the tab:
// a peer's change or an undo replaces the photo and reloads only the tiles that changed. A commit
// encodes the changed tiles (off the main thread), names them by content, hands them to the upload
// queue and commits the next photo as one tab edit, in order.
import type { PhotoBlobEntry } from '@livedesign/api-schema';
import {
  blobIdOf,
  isShown,
  PHOTO_TILE,
  parseTileKey,
  tileKey,
  TiledRaster,
  type LayerPixels,
  type Mask8,
  type Photo,
  type PhotoLayer,
  type PixelsLookup,
  type Raster,
  type TileMap,
} from '@livedesign/photo-engine';
import type { PixelsStore } from './pixels-store';
import { photoWorkers } from './photo-worker-client';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';

/** The set under `key`, made when missing. */
function setIn<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  return set;
}

export type SessionDeps = {
  tabId: string;
  pageId: string;
  store: PixelsStore;
  enqueue: (tabId: string, entries: PhotoBlobEntry[]) => void;
  // Writes the next photo as one tab edit; `undoable: false` for a preview's remake.
  commit: (photo: Photo, label: string, opts?: { undoable?: boolean }) => void;
  // A gesture's steps as one edit: a checkpoint first, then commits with `undoable: false`; a
  // gesture that changed nothing cancels back to its checkpoint (the Text tool's typing).
  checkpoint: () => void;
  cancelCheckpoint: () => void;
  // The gesture is over: later commits are steps of their own again.
  endCheckpoint: () => void;
};

/** Which tiles of which layer (or mask) changed: what the screen redraws. */
export type TileChange = { layerId: string; target: 'layer' | 'mask'; keys: string[] };

type Listener = (changes: TileChange[] | null) => void;

const maskId = (layerId: string) => `${layerId}#mask`;

/** A mask tile (one channel) as RGBA grey, as it is stored. */
function maskToRgba(tile: Uint8ClampedArray): Uint8ClampedArray {
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

function rgbaToMask(tile: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(tile.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = tile[i * 4]!;
  return out;
}

// A mutable object, raising `version` on each change the screen should redraw: the React Compiler's memo would
// keep what a component read from it the first time, so the photo components that read it as they render opt
// out with 'use no memo' and re-render on `version`.
export class PhotoSession {
  readonly tabId: string;
  readonly pageId: string;
  private readonly deps: SessionDeps;
  photo: Photo;
  private readonly rasters = new Map<string, TiledRaster>();
  // Each loaded raster's tile map as it was loaded, to tell what a new photo changed.
  private readonly loadedMaps = new Map<string, LayerPixels>();
  // This person's active layer: set, it redraws what reads it (an op sets it after its commit).
  private activeId: string | null = null;
  get active(): string | null {
    return this.activeId;
  }
  set active(id: string | null) {
    if (id === this.activeId) return;
    this.activeId = id;
    this.changed();
  }
  target: 'layer' | 'mask' = 'layer';
  selection: Mask8 | null = null;
  lastSelection: Mask8 | null = null;
  // The layer shown alone (Alt+press on its eye), this person's view only.
  solo: string | null = null;
  // The layers chosen beside the active one (Shift or Ctrl/Cmd+press in the Layers tab), this person's
  // own: Group, Merge, Duplicate, Delete and the Move tool act on them together.
  chosen: ReadonlySet<string> = new Set();
  // Raised on every change the screen should redraw.
  version = 0;
  private readonly listeners = new Set<Listener>();
  private chain: Promise<unknown> = Promise.resolve();
  private loadingCount = 0;
  private disposed = false;
  // By raster (a layer or its mask), its tiles whose own change is unfinished here (painted, or being
  // committed): a peer's tile for one of them is held, and this person's commit, the later, wins.
  private readonly committing = new Map<string, Set<string>>();
  private readonly held = new Map<string, Set<string>>();
  // The tiles a peer changed since the raster's last commit or restore: a cancelled gesture's raster,
  // taken before it began, takes them up again.
  private readonly peerKeys = new Map<string, Set<string>>();

  constructor(photo: Photo, deps: SessionDeps) {
    this.deps = deps;
    this.tabId = deps.tabId;
    this.pageId = deps.pageId;
    this.photo = photo;
    this.active = topPixelLayer(photo)?.id ?? photo.layers.at(-1)?.id ?? null;
    this.sync(photo);
    debugLog('[photo] session-open', { pageId: this.pageId, layers: photo.layers.length });
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Something changed: the screen redraws (`changes` names the tiles, null redraws everything). An empty
   *  list changed no pixels (an active layer, a preview of the stack): the GPU keeps every tile it holds, so
   *  a 40-megapixel photo is not uploaded again at each step of an adjustment's slider. */
  changed(changes: TileChange[] | null = null): void {
    this.version++;
    for (const fn of this.listeners) fn(changes);
  }

  /** Tiles changed mid-stroke: the photo is drawn again (its listeners), but `version` stays, so the
   *  panels re-render when the stroke commits, not at every dab. */
  redraw(changes: TileChange[]): void {
    for (const fn of this.listeners) fn(changes);
  }

  /** Resolves once every layer's tiles have arrived (an export of a photo not in focus). */
  whenLoaded(): Promise<void> {
    if (!this.loading) return Promise.resolve();
    return new Promise((resolve) => {
      const off = this.subscribe(() => {
        if (this.loading) return;
        off();
        resolve();
      });
    });
  }

  /** Whether layers' tiles are still on their way. */
  get loading(): boolean {
    return this.loadingCount > 0;
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  layer(id: string | null): PhotoLayer | undefined {
    return id ? this.photo.layers.find((l) => l.id === id) : undefined;
  }

  /** A layer's pixels (or its mask's), made empty when it has none yet. */
  raster(layerId: string, target: 'layer' | 'mask' = 'layer'): TiledRaster {
    const key = target === 'mask' ? maskId(layerId) : layerId;
    let r = this.rasters.get(key);
    if (!r) {
      r = target === 'mask' ? new TiledRaster(1, 255) : new TiledRaster(4, 0);
      this.rasters.set(key, r);
    }
    return r;
  }

  /** What the compositor reads. */
  lookup(): PixelsLookup {
    return {
      layer: (id) => this.rasters.get(id),
      mask: (id) => this.rasters.get(maskId(id)),
    };
  }

  /** The tab's photo now (a peer's change, an undo, our own commit coming back): loads what changed. */
  setPhoto(next: Photo): void {
    if (next === this.photo) return;
    this.photo = next;
    this.keepToLayers(next);
    this.sync(next);
    this.changed();
  }

  /** The active and chosen layers kept to the photo's: none active, or the active one gone (a photo just
   *  started, a delete, a peer's), makes the top pixel layer active. */
  private keepToLayers(photo: Photo): void {
    const has = (id: string) => photo.layers.some((l) => l.id === id);
    if (!this.active || !has(this.active))
      this.active = topPixelLayer(photo)?.id ?? photo.layers.at(-1)?.id ?? null;
    if ([...this.chosen].some((id) => !has(id)))
      this.chosen = new Set([...this.chosen].filter(has));
  }

  /** The layers a layer command acts on, in stack order: the chosen ones with the active one, else the
   *  active one alone. */
  inHand(): string[] {
    if (!this.chosen.size) return this.active ? [this.active] : [];
    return this.photo.layers
      .map((l) => l.id)
      .filter((id) => this.chosen.has(id) || id === this.active);
  }

  private sync(photo: Photo): void {
    const live = new Set<string>();
    for (const l of photo.layers) {
      if (l.layerKind === 'pixel') {
        live.add(l.id);
        this.syncPixels(l.id, 'layer', l.pixels);
      }
      if (l.mask) {
        live.add(maskId(l.id));
        this.syncPixels(l.id, 'mask', l.mask.pixels);
      }
    }
    for (const key of [...this.rasters.keys()]) {
      if (live.has(key)) continue;
      this.rasters.delete(key);
      this.loadedMaps.delete(key);
      this.committing.delete(key);
      this.held.delete(key);
      this.peerKeys.delete(key);
    }
  }

  private syncPixels(layerId: string, target: 'layer' | 'mask', pixels: LayerPixels): void {
    const key = target === 'mask' ? maskId(layerId) : layerId;
    const was = this.loadedMaps.get(key);
    if (was === pixels) return;
    this.loadedMaps.set(key, pixels);
    const raster = this.raster(layerId, target);
    const sourceChanged = was?.source?.blob !== pixels.source?.blob;
    const changedKeys = new Set<string>();
    const before: TileMap = sourceChanged ? {} : (was?.tiles ?? {});
    for (const k of new Set([...Object.keys(before), ...Object.keys(pixels.tiles)]))
      if (before[k] !== pixels.tiles[k]) changedKeys.add(k);
    if (sourceChanged) {
      for (const k of raster.keys()) changedKeys.add(k);
      for (const k of raster.clearedKeys()) changedKeys.add(k);
    }
    if (pixels.source && sourceChanged) void this.loadSource(layerId, target, pixels);
    const busy = new Set([...raster.peekDirty(), ...(this.committing.get(key) ?? [])]);
    const peer = setIn(this.peerKeys, key);
    let held = 0;
    for (const k of changedKeys) {
      peer.add(k);
      if (busy.has(k)) {
        setIn(this.held, key).add(k);
        held++;
        continue;
      }
      this.applyTile(layerId, target, pixels, k, sourceChanged);
    }
    if (held) debugLog('[photo] remote-tiles-held', { layerId, target, tiles: held });
    if (changedKeys.size) this.changed([{ layerId, target, keys: [...changedKeys] }]);
  }

  /** One tile of the raster made what `pixels` says. */
  private applyTile(
    layerId: string,
    target: 'layer' | 'mask',
    pixels: LayerPixels,
    k: string,
    sourceChanged: boolean,
  ): void {
    const raster = this.raster(layerId, target);
    const id = pixels.tiles[k];
    if (id === '') {
      raster.markCleared(k);
      return;
    }
    if (id === undefined) {
      // Back to the source (or nothing): a source is sliced in when it loads.
      raster.unload(k);
      if (pixels.source && !sourceChanged) void this.loadSource(layerId, target, pixels, k);
      return;
    }
    this.loadTile(layerId, target, k, id);
  }

  private loadTile(layerId: string, target: 'layer' | 'mask', key: string, id: string): void {
    const cached = this.deps.store.peek(id);
    const place = (data: Uint8ClampedArray) => {
      // A newer photo may have moved on since the load began.
      const current = this.loadedMaps.get(target === 'mask' ? maskId(layerId) : layerId);
      if (current?.tiles[key] !== id) return;
      this.raster(layerId, target).load(key, target === 'mask' ? rgbaToMask(data) : data);
    };
    if (cached) {
      place(cached);
      return;
    }
    this.loadingCount++;
    void this.deps.store.tile(this.tabId, id).then((data) => {
      this.loadingCount--;
      if (this.disposed) return;
      if (data) place(data);
      this.changed([{ layerId, target, keys: [key] }]);
    });
  }

  private async loadSource(
    layerId: string,
    target: 'layer' | 'mask',
    pixels: LayerPixels,
    only?: string,
  ): Promise<void> {
    const source = pixels.source!;
    this.loadingCount++;
    const pic = await this.deps.store.source(this.tabId, source);
    this.loadingCount--;
    if (!pic || this.disposed) {
      // Told even when it failed: whoever waits on the loading hears it end.
      if (!this.disposed) this.changed();
      return;
    }
    const raster = this.raster(layerId, target);
    const keys: string[] = [];
    for (const [col, row] of TiledRaster.tilesIn({
      x: 0,
      y: 0,
      width: pic.width,
      height: pic.height,
    })) {
      const k = tileKey(col, row);
      if (only && k !== only) continue;
      // An explicit tile wins over the source.
      if (pixels.tiles[k] !== undefined) continue;
      const tile = new Uint8ClampedArray(PHOTO_TILE * PHOTO_TILE * 4);
      for (let y = 0; y < PHOTO_TILE; y++) {
        const py = row * PHOTO_TILE + y;
        if (py >= pic.height) break;
        const from = (py * pic.width + col * PHOTO_TILE) * 4;
        const len = Math.max(0, Math.min(PHOTO_TILE, pic.width - col * PHOTO_TILE)) * 4;
        tile.set(pic.data.subarray(from, from + len), y * PHOTO_TILE * 4);
      }
      raster.load(k, target === 'mask' ? rgbaToMask(tile) : tile);
      keys.push(k);
    }
    this.changed([{ layerId, target, keys }]);
  }

  /** Whether a layer shows (it and its groups are visible). */
  shown(id: string): boolean {
    return isShown(this.photo.layers, id);
  }

  /** The stack changed without pixels (a setting, a new empty layer, a reorder): one edit, held at
   *  once so the next edit builds on it; a pixel commit still encoding patches its tiles into it. */
  commitStack(next: Photo, label: string, opts?: { undoable?: boolean }): void {
    const photo = { ...next, rev: (next.rev ?? this.photo.rev ?? 0) + 1 };
    this.photo = photo;
    this.keepToLayers(photo);
    this.sync(photo);
    this.deps.commit(photo, label, opts);
    this.changed();
  }

  /** This person's active layer (and what painting targets on it), redrawn. */
  choose(layerId: string | null, target: 'layer' | 'mask' = 'layer'): void {
    this.active = layerId;
    const l = this.layer(layerId);
    this.target = target === 'mask' && l?.mask ? 'mask' : 'layer';
    this.changed([]);
  }

  /** The layers chosen beside the active one, redrawn. */
  setChosen(ids: ReadonlySet<string>): void {
    this.chosen = ids;
    this.changed([]);
  }

  /** The layer shown alone (Alt+press on its eye), or every layer again. */
  setSolo(layerId: string | null): void {
    this.solo = layerId;
    this.changed([]);
  }

  /** The photo shown mid-gesture (a drag of a layer), not yet an edit: the gesture's end commits. */
  preview(next: Photo): void {
    this.photo = next;
    this.keepToLayers(next);
    this.changed([]);
  }

  /** A layer's pixels put back as they were before a gesture that was cancelled: the raster taken
   *  before it (a clone, its own dirty set) replaces the one it changed. */
  restorePixels(layerId: string, target: 'layer' | 'mask', before: TiledRaster): void {
    const key = target === 'mask' ? maskId(layerId) : layerId;
    this.rasters.set(key, before);
    // What a peer changed meanwhile, the raster taken before lacks: taken up again.
    const again = new Set([...(this.peerKeys.get(key) ?? []), ...(this.held.get(key) ?? [])]);
    this.peerKeys.delete(key);
    this.held.delete(key);
    const pixels = this.loadedMaps.get(key);
    if (pixels) for (const k of again) this.applyTile(layerId, target, pixels, k, false);
    this.changed(again.size ? [{ layerId, target, keys: [...again] }] : null);
  }

  /** Blobs made outside a pixel commit (an opened picture kept whole): stored and sent. */
  upload(entries: PhotoBlobEntry[], decoded?: { id: string; raster: Raster; blob: Blob }): void {
    if (decoded) this.deps.store.putSource(decoded.id, decoded.raster, decoded.blob);
    this.deps.enqueue(this.tabId, entries);
  }

  /** A gesture made of several steps begins: they undo as one. */
  checkpoint(): void {
    this.deps.checkpoint();
  }

  /** The gesture ended, as one step. */
  endGesture(): void {
    this.deps.endCheckpoint();
  }

  /** The gesture changed nothing: its checkpoint is dropped. */
  cancelCheckpoint(): void {
    this.deps.cancelCheckpoint();
  }

  /** The changed tiles of these layers (or masks) encoded and named, and the next photo committed
   *  with them (and any stack change in `stack`, applied first and to the photo as it is when the
   *  tiles are ready, so it must hold if applied again), as one edit. */
  commitPixels(
    label: string,
    targets: readonly { layerId: string; target: 'layer' | 'mask'; dropSource?: boolean }[],
    stack?: (p: Photo) => Photo,
  ): void {
    // The dirty sets are taken now, at the edit's end, so the next edit's tiles are its own.
    const work = targets.map(({ layerId, target, dropSource }) => {
      const key = target === 'mask' ? maskId(layerId) : layerId;
      const raster = this.raster(layerId, target);
      const keys = raster.takeDirty();
      for (const k of keys) setIn(this.committing, key).add(k);
      this.peerKeys.delete(key);
      // Copies: the encode moves its buffer to the worker, and the raster keeps painting.
      const cleared = new Set(raster.clearedKeys());
      const tiles = keys.map((k) => {
        const p = parseTileKey(k)!;
        const t = raster.peek(p.col, p.row);
        return { key: k, data: t ? new Uint8ClampedArray(t) : null, cleared: cleared.has(k) };
      });
      return { key, layerId, target, tiles, dropSource: dropSource === true };
    });
    // Whatever becomes of the commit, its tiles are no longer unfinished.
    const finish = () => {
      for (const w of work)
        for (const { key: k } of w.tiles) {
          this.committing.get(w.key)?.delete(k);
          this.held.get(w.key)?.delete(k);
        }
    };
    const run = async () => {
      const entries: PhotoBlobEntry[] = [];
      // Each tile's outcome: a blob id, '' (cleared) or null (back to the source, or nothing).
      const outcomes = await Promise.all(
        work.map(async (w) => {
          const set = new Map<string, string | null>();
          const hasSource = !w.dropSource && !!pixelsOf(this.photo, w.layerId, w.target)?.source;
          await Promise.all(
            w.tiles.map(async ({ key, data, cleared }) => {
              if (!data) {
                // Cleared (a layer's emptied tile over a source, a mask's black) is kept as such; a
                // tile reset reads as the source, or nothing, again.
                set.set(key, cleared && (hasSource || w.target === 'mask') ? '' : null);
                return;
              }
              if (isEmptyTile(data, w.target)) {
                // A transparent tile over a source must say so; a mask's white is its empty.
                set.set(key, w.target === 'layer' && hasSource ? '' : null);
                return;
              }
              const rgba = w.target === 'mask' ? maskToRgba(data) : data;
              const res = await photoWorkers().run({
                kind: 'encode',
                width: PHOTO_TILE,
                height: PHOTO_TILE,
                data: new Uint8ClampedArray(rgba),
                type: 'image/png',
              }).result;
              if (res.kind !== 'encode') return;
              const id = await blobIdOf(res.bytes);
              this.deps.store.put(
                id,
                rgba,
                new Blob([res.bytes as Uint8Array<ArrayBuffer>], { type: 'image/png' }),
              );
              entries.push({ id, type: 'image/png', bytes: res.bytes });
              set.set(key, id);
            }),
          );
          return set;
        }),
      );
      // No await from here: the tiles land on the photo as it is now, stack edits made meanwhile kept.
      // The stack change comes first, so a commit can add the layer its pixels are for.
      let photo = stack ? stack(this.photo) : this.photo;
      work.forEach((w, i) => {
        const pixels = pixelsOf(photo, w.layerId, w.target);
        if (!photo.layers.some((l) => l.id === w.layerId)) return;
        // Pixels rebuilt whole (a resize, a turn) leave the source behind: every tile is explicit.
        const keepSource = !w.dropSource ? pixels?.source : undefined;
        const tiles: TileMap = w.dropSource ? {} : { ...(pixels?.tiles ?? {}) };
        for (const [key, id] of outcomes[i]!) {
          if (id === null) delete tiles[key];
          else tiles[key] = id;
        }
        const nextPixels: LayerPixels = { ...(keepSource ? { source: keepSource } : {}), tiles };
        photo = {
          ...photo,
          layers: photo.layers.map((l) => {
            if (l.id !== w.layerId) return l;
            if (w.target === 'mask')
              return {
                ...l,
                mask: { ...(l.mask ?? { pixels: { tiles: {} } }), pixels: nextPixels },
              };
            return l.layerKind === 'pixel' ? { ...l, pixels: nextPixels } : l;
          }),
        };
        // What this session now holds is what the photo says: no reload of its own tiles.
        this.loadedMaps.set(w.target === 'mask' ? maskId(w.layerId) : w.layerId, nextPixels);
      });
      photo = { ...photo, rev: (photo.rev ?? 0) + 1 };
      if (entries.length) this.deps.enqueue(this.tabId, entries);
      this.photo = photo;
      this.keepToLayers(photo);
      for (const l of photo.layers) {
        if (l.layerKind === 'pixel' && !this.loadedMaps.has(l.id))
          this.loadedMaps.set(l.id, l.pixels);
        if (l.mask && !this.loadedMaps.has(maskId(l.id)))
          this.loadedMaps.set(maskId(l.id), l.mask.pixels);
      }
      debugLog('[photo] commit', label, { tiles: entries.length });
      this.deps.commit(photo, label);
      this.changed();
    };
    this.queue(() => run().finally(finish));
  }

  /** A raster written whole as a layer's new pixels (a filter, a transform, a pasted picture). */
  replacePixels(layerId: string, target: 'layer' | 'mask', next: TiledRaster): void {
    const key = target === 'mask' ? maskId(layerId) : layerId;
    const old = this.rasters.get(key);
    // Every tile either side becomes dirty: those gone and those new.
    for (const k of old?.keys() ?? []) if (!next.has(...colRow(k))) next.resetTile(k);
    for (const k of next.keys()) {
      const [c, r] = colRow(k);
      next.writable(c, r);
    }
    this.rasters.set(key, next);
    this.changed();
  }

  private queue(task: () => Promise<void>): void {
    this.chain = this.chain
      .then(task)
      .catch((err: unknown) => console.warn('[photo] commit failed', { error: String(err) }));
  }

  /** Resolves once every commit asked for so far has been made. */
  settled(): Promise<void> {
    return this.chain.then(() => undefined);
  }
}

function pixelsOf(
  photo: Photo,
  layerId: string,
  target: 'layer' | 'mask',
): LayerPixels | undefined {
  const layer = photo.layers.find((l) => l.id === layerId);
  if (!layer) return undefined;
  if (target === 'mask') return layer.mask?.pixels;
  return layer.layerKind === 'pixel' ? layer.pixels : undefined;
}

const colRow = (k: string): [number, number] => {
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
