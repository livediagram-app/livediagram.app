// Filters and applied adjustments (docs/specs/031-photo/photo-adjustments.md "The Adjust tab" applied,
// "Filters", "Performance"): a change worked on the active pixel layer (or its mask) within the
// selection. The dialog's preview draws it on the visible part of the photo, in the worker for a
// filter; OK works it on the whole area and commits it as one edit; Cancel puts the layer back.
import {
  FILTERS,
  adjustmentForm,
  applyForm,
  hexToBytes,
  histogramOf,
  maskBounds,
  type Mask8,
  type PhotoAdjustment,
  type PhotoLayer,
  type Raster,
  type Rect,
  type TiledRaster,
} from '@livedesign/photo-engine';
import { extentOf } from './layer-ops';
import { photoWorkers, type PhotoTaskHandle } from './photo-worker-client';
import type { PhotoSession } from './session';
import { shakeLock } from './lock-shake';

export type Applying = {
  layerId: string;
  target: 'layer' | 'mask';
  // Photo px of the area the change may reach, and where the target's px sit in the photo.
  area: Rect;
  at: { x: number; y: number };
  selection: Mask8 | null;
  // The target's pixels before, for Cancel and for each preview to start from.
  before: TiledRaster;
};

const intersect = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  return x1 > x && y1 > y ? { x, y, width: x1 - x, height: y1 - y } : null;
};

const grow = (r: Rect, by: number): Rect => ({
  x: r.x - by,
  y: r.y - by,
  width: r.width + by * 2,
  height: r.height + by * 2,
});

const offsetOf = (l: PhotoLayer, target: 'layer' | 'mask') =>
  target === 'mask' && l.mask?.linked === false
    ? (l.mask.offset ?? { x: 0, y: 0 })
    : l.layerKind === 'pixel'
      ? (l.offset ?? { x: 0, y: 0 })
      : { x: 0, y: 0 };

/** What a filter or an applied adjustment works on now; a reason when it cannot. */
export function startApplying(s: PhotoSession): Applying | string {
  const layer = s.layer(s.active);
  if (!layer) return 'Choose a layer first.';
  const target = s.target === 'mask' && layer.mask ? 'mask' : 'layer';
  if (target === 'layer' && layer.layerKind !== 'pixel') return 'rasterize';
  if (layer.visible === false) return `${layer.name} is hidden. Show it to change it.`;
  if (target === 'layer' && (layer.locks?.pixels || layer.locks?.all)) {
    shakeLock(layer.id);
    return `${layer.name} is locked.`;
  }
  const photo = { x: 0, y: 0, width: s.photo.width, height: s.photo.height };
  const extent = target === 'layer' ? extentOf(s, layer) : null;
  // The photo, and whatever of the layer lies past its edges.
  let area = extent
    ? (() => {
        const x = Math.min(0, extent.x);
        const y = Math.min(0, extent.y);
        return {
          x,
          y,
          width: Math.max(photo.width, extent.x + extent.width) - x,
          height: Math.max(photo.height, extent.y + extent.height) - y,
        };
      })()
    : photo;
  const sel = s.selection;
  const sb = sel ? maskBounds(sel) : null;
  if (sel && !sb) return 'The selection is empty.';
  if (sb) area = intersect(area, sb) ?? sb;
  return {
    layerId: layer.id,
    target,
    area,
    at: offsetOf(layer, target),
    selection: sel,
    before: s.raster(layer.id, target).clone(),
  };
}

/** `changed` (photo px at `rect`) written over the target's pixels as they were before, within the
 *  selection. */
function writeBack(s: PhotoSession, a: Applying, rect: Rect, changed: Raster): void {
  const local = { x: rect.x - a.at.x, y: rect.y - a.at.y, width: rect.width, height: rect.height };
  const was = a.before.read(local);
  const sel = a.selection;
  const out = was;
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) {
      let m = 255;
      if (sel) {
        const mx = rect.x + x - sel.x;
        const my = rect.y + y - sel.y;
        m =
          mx < 0 || my < 0 || mx >= sel.width || my >= sel.height
            ? 0
            : sel.data[my * sel.width + mx]!;
      }
      if (!m) continue;
      const i = (y * rect.width + x) * 4;
      const k = m / 255;
      for (let c = 0; c < 4; c++)
        out.data[i + c] = was.data[i + c]! + (changed.data[i + c]! - was.data[i + c]!) * k;
    }
  s.raster(a.layerId, a.target).write(out, local.x, local.y);
}

/** The area's pixels as they were, with the margin a change reads past it. */
function source(a: Applying, rect: Rect): Raster {
  return a.before.read({
    x: rect.x - a.at.x,
    y: rect.y - a.at.y,
    width: rect.width,
    height: rect.height,
  });
}

/** Cut a change worked over `read` back to `rect`. */
function crop(r: Raster, read: Rect, rect: Rect): Raster {
  if (
    read.x === rect.x &&
    read.y === rect.y &&
    read.width === rect.width &&
    read.height === rect.height
  )
    return r;
  const out = {
    width: rect.width,
    height: rect.height,
    data: new Uint8ClampedArray(rect.width * rect.height * 4),
  };
  for (let y = 0; y < rect.height; y++) {
    const from = ((rect.y - read.y + y) * read.width + (rect.x - read.x)) * 4;
    out.data.set(r.data.subarray(from, from + rect.width * 4), y * rect.width * 4);
  }
  return out;
}

/** An adjustment worked on the area (or its visible part), in place: fast, on this thread. */
export function adjustArea(
  s: PhotoSession,
  a: Applying,
  adjustment: PhotoAdjustment,
  visible?: Rect,
): void {
  const rect = (visible && intersect(a.area, visible)) || a.area;
  const pic = source(a, rect);
  // Auto adjustments read the whole area's histogram, so the preview matches OK.
  const histogram = histogramOf(source(a, a.area), 4);
  applyForm(pic, adjustmentForm(adjustment, histogram));
  s.restorePixels(a.layerId, a.target, a.before.clone());
  writeBack(s, a, rect, pic);
  s.changed();
}

/** A filter worked in the worker on the area (or its visible part, with the margin it reads). */
/** The filter worked on `rect` alone (photo px) from the pixels before, for the dialog's square at 100%:
 *  its margin read around it, cut back to it. A filter that reads the whole layer is shown on the square's
 *  own pixels. */
export function filterSquare(
  s: PhotoSession,
  a: Applying,
  id: string,
  params: Record<string, unknown>,
  colours: { foreground: string; background: string },
  rect: Rect,
): PhotoTaskHandle & { done: Promise<Raster | null> } {
  const def = FILTERS[id]!;
  const margin = def.margin(params);
  const read = Number.isFinite(margin) ? grow(rect, Math.ceil(margin)) : rect;
  const handle = photoWorkers().run({
    kind: 'filter',
    id,
    params,
    raster: source(a, read),
    ctx: {
      seed: 1,
      foreground: hexToBytes(colours.foreground),
      background: hexToBytes(colours.background),
      photo: { width: s.photo.width, height: s.photo.height, x: read.x, y: read.y },
    },
  });
  const done = handle.result
    .then((res) => (res.kind === 'filter' ? crop(res.raster, read, rect) : null))
    .catch(() => null);
  return { ...handle, done };
}

export function filterArea(
  s: PhotoSession,
  a: Applying,
  id: string,
  params: Record<string, unknown>,
  colours: { foreground: string; background: string },
  visible?: Rect,
  progress?: (done: number) => void,
): { handle: PhotoTaskHandle; done: Promise<boolean> } {
  const def = FILTERS[id]!;
  const margin = def.margin(params);
  const rect = Number.isFinite(margin) && visible ? (intersect(a.area, visible) ?? a.area) : a.area;
  const read = Number.isFinite(margin) ? grow(rect, Math.ceil(margin)) : a.area;
  const handle = photoWorkers().run(
    {
      kind: 'filter',
      id,
      params,
      raster: source(a, read),
      ctx: {
        seed: 1,
        foreground: hexToBytes(colours.foreground),
        background: hexToBytes(colours.background),
        photo: { width: s.photo.width, height: s.photo.height, x: read.x, y: read.y },
      },
    },
    progress,
  );
  const done = handle.result
    .then((res) => {
      if (res.kind !== 'filter') return false;
      s.restorePixels(a.layerId, a.target, a.before.clone());
      writeBack(s, a, rect, crop(res.raster, read, rect));
      s.changed();
      return true;
    })
    .catch(() => false);
  return { handle, done };
}

export function commitApplying(s: PhotoSession, a: Applying, label: string): void {
  s.commitPixels(label, [{ layerId: a.layerId, target: a.target }]);
}

export function cancelApplying(s: PhotoSession, a: Applying): void {
  s.restorePixels(a.layerId, a.target, a.before);
}
