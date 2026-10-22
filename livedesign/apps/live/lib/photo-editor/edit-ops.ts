// Fill… and Delete (docs/specs/031-photo/photo-tools.md "Retouching" Content-Aware Fill, "Keyboard
// summary"): the selection (or the whole layer) filled with a colour by a blend mode and opacity, or
// from the rest of the layer (Content-Aware, in the worker), or its pixels made transparent.
import {
  blendOnto,
  colourRaster,
  hexToBytes,
  lumaByte,
  maskBounds,
  type BlendMode,
  type Mask8,
  type PhotoLayer,
  type Rect,
} from '@livedesign/photo-engine';
import { photoWorkers } from './photo-worker-client';
import type { PhotoSession } from './session';
import { shakeLock } from './lock-shake';

export type FillContents =
  'foreground' | 'background' | 'colour' | 'black' | 'grey' | 'white' | 'content-aware';

export type FillChoice = {
  contents: FillContents;
  colour?: string;
  mode?: BlendMode;
  opacity?: number;
  preserveTransparency?: boolean;
};

const offsetOf = (l: PhotoLayer, target: 'layer' | 'mask') =>
  target === 'mask' && l.mask?.linked === false
    ? (l.mask.offset ?? { x: 0, y: 0 })
    : l.layerKind === 'pixel'
      ? (l.offset ?? { x: 0, y: 0 })
      : { x: 0, y: 0 };

/** What a fill or a delete acts on: the active pixel layer (or its mask), refusing a locked or hidden one. */
function target(s: PhotoSession): { layer: PhotoLayer; target: 'layer' | 'mask' } | string {
  const layer = s.layer(s.active);
  if (!layer) return 'Choose a layer first.';
  const t = s.target === 'mask' && layer.mask ? 'mask' : 'layer';
  if (t === 'layer' && layer.layerKind !== 'pixel')
    return 'Choose a pixel layer, or rasterize this one.';
  if (layer.visible === false) return `${layer.name} is hidden. Show it to change it.`;
  if (t === 'layer' && (layer.locks?.pixels || layer.locks?.all)) {
    shakeLock(layer.id);
    return `${layer.name} is locked.`;
  }
  return { layer, target: t };
}

const areaOf = (s: PhotoSession): { rect: Rect; mask: Mask8 | null } => {
  const sel = s.selection;
  const b = sel ? maskBounds(sel) : null;
  return b
    ? { rect: b, mask: sel }
    : { rect: { x: 0, y: 0, width: s.photo.width, height: s.photo.height }, mask: null };
};

export function fillColourOf(
  choice: FillChoice,
  colours: { foreground: string; background: string },
): string {
  switch (choice.contents) {
    case 'foreground':
      return colours.foreground;
    case 'background':
      return colours.background;
    case 'black':
      return '#000000';
    case 'grey':
      return '#808080';
    case 'white':
      return '#ffffff';
    default:
      return choice.colour ?? colours.foreground;
  }
}

/** Fill…: a colour over the selection (or the layer), or Content-Aware. */
export function fillSelection(
  s: PhotoSession,
  choice: FillChoice,
  colours: { foreground: string; background: string },
): Promise<string | null> | string | null {
  const t = target(s);
  if (typeof t === 'string') return t;
  if (choice.contents === 'content-aware') return contentAwareFill(s);
  const { rect, mask } = areaOf(s);
  const o = offsetOf(t.layer, t.target);
  const raster = s.raster(t.layer.id, t.target);
  const local = { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height };
  const dst = raster.read(local);
  const keepAlpha =
    t.target === 'layer' && (choice.preserveTransparency || t.layer.locks?.transparency);
  const before = keepAlpha ? dst.data.slice() : null;
  let rgb: number[] = [...hexToBytes(fillColourOf(choice, colours))];
  if (t.target === 'mask') {
    const g = lumaByte(rgb[0]!, rgb[1]!, rgb[2]!);
    rgb = [g, g, g];
  }
  blendOnto(
    dst,
    rect,
    colourRaster(rect, rgb),
    rect,
    t.target === 'mask' ? 'normal' : (choice.mode ?? 'normal'),
    choice.opacity ?? 1,
    mask,
  );
  if (before) for (let i = 3; i < dst.data.length; i += 4) dst.data[i] = before[i]!;
  raster.write(dst, local.x, local.y);
  s.changed();
  s.commitPixels('Fill', [{ layerId: t.layer.id, target: t.target }]);
  return null;
}

/** Delete: the selection's pixels made transparent (on a mask, black); with locked transparency, the
 *  background colour instead. */
export function clearSelection(s: PhotoSession, background: string): string | null {
  const t = target(s);
  if (typeof t === 'string') return t;
  if (!s.selection) return 'Make a selection first.';
  if (t.target === 'layer' && t.layer.locks?.transparency)
    return fillSelection(s, { contents: 'background' }, { foreground: background, background }) as
      string | null;
  const { rect, mask } = areaOf(s);
  const o = offsetOf(t.layer, t.target);
  const raster = s.raster(t.layer.id, t.target);
  const local = { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height };
  const dst = raster.read(local);
  for (let i = 0; i < rect.width * rect.height; i++) {
    const mx = rect.x + (i % rect.width) - (mask?.x ?? 0);
    const my = rect.y + Math.floor(i / rect.width) - (mask?.y ?? 0);
    const m = !mask
      ? 255
      : mx < 0 || my < 0 || mx >= mask.width || my >= mask.height
        ? 0
        : mask.data[my * mask.width + mx]!;
    if (t.target === 'mask') {
      const v = (dst.data[i * 4]! * (255 - m)) / 255;
      dst.data[i * 4] = v;
    } else dst.data[i * 4 + 3] = (dst.data[i * 4 + 3]! * (255 - m)) / 255;
  }
  raster.write(dst, local.x, local.y);
  s.changed();
  s.commitPixels('Clear', [{ layerId: t.layer.id, target: t.target }]);
  return null;
}

// Content-Aware looks this far around the selection for patches, as a share of its size, and never
// less than CONTENT_AWARE_MIN_REACH px: the patch search keeps clear of the hole by its patch radius and
// the area's edge by as much again, so a small selection (a blemish) with a reach of its own size had
// no patches left to fill from.
export const CONTENT_AWARE_REACH = 1;
export const CONTENT_AWARE_MIN_REACH = 32;

/** Content-Aware Fill: the selection filled from the rest of the layer, in the worker. */
export async function contentAwareFill(s: PhotoSession): Promise<string | null> {
  const t = target(s);
  if (typeof t === 'string') return t;
  if (t.target === 'mask') return 'Content-Aware works on a layer’s pixels, not its mask.';
  const sel = s.selection;
  const b = sel ? maskBounds(sel) : null;
  if (!sel || !b) return 'Make a selection first.';
  const reach = Math.max(
    CONTENT_AWARE_MIN_REACH,
    Math.ceil(Math.max(b.width, b.height) * CONTENT_AWARE_REACH),
  );
  const rect = {
    x: Math.max(0, b.x - reach),
    y: Math.max(0, b.y - reach),
    width: 0,
    height: 0,
  };
  rect.width = Math.min(s.photo.width, b.x + b.width + reach) - rect.x;
  rect.height = Math.min(s.photo.height, b.y + b.height + reach) - rect.y;
  const o = offsetOf(t.layer, 'layer');
  const raster = s.raster(t.layer.id);
  const local = { x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height };
  const pic = raster.read(local);
  const hole = new Uint8Array(rect.width * rect.height);
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) {
      const mx = rect.x + x - sel.x;
      const my = rect.y + y - sel.y;
      if (
        mx >= 0 &&
        my >= 0 &&
        mx < sel.width &&
        my < sel.height &&
        sel.data[my * sel.width + mx]! >= 128
      )
        hole[y * rect.width + x] = 1;
    }
  const res = await photoWorkers().run({ kind: 'fill', raster: pic, hole, seed: 11 }).result;
  if (res.kind !== 'fill') return 'Content-Aware Fill failed.';
  raster.write(res.raster, local.x, local.y);
  s.changed();
  s.commitPixels('Content-Aware Fill', [{ layerId: t.layer.id, target: 'layer' }]);
  return null;
}
