// What every photo tool works with (docs/specs/031-photo/photo-tools.md "Shared gestures and
// options"): the session, the person's options and colours, the photo's pixels to sample, and the
// rules every tool keeps: a locked layer refuses, a hidden one refuses, a missing pixel layer is made.
import {
  addLayer,
  compositePhoto,
  hexToBytes,
  layerNameStem,
  newLayerId,
  nextLayerName,
  type Mask8,
  type Matrix,
  type Photo,
  type PhotoLayer,
  type PixelLayer,
  type Raster,
  type Rect,
} from '@livedesign/photo-engine';
import type { PhotoSession } from '../session';
import { rasterizeText } from '../text-raster';
import type { PhotoToolState } from '../tool-state';
import { shakeLock } from '../lock-shake';

/** A pointer on the photo: photo px (fractional), its pressure and keys. */
export type PhotoPoint = {
  x: number;
  y: number;
  pressure: number;
  shift: boolean;
  alt: boolean;
  mod: boolean;
  // Screen px per photo px now, for reach given in screen px.
  scale: number;
};

/** What a tool shows over the photo while it works (drawn by PhotoOverlays). */
export type ToolOverlay =
  | { kind: 'none' }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; ellipse: boolean }
  | {
      kind: 'path';
      points: { x: number; y: number }[];
      closed: boolean;
      live?: { x: number; y: number };
    }
  | { kind: 'line'; from: { x: number; y: number }; to: { x: number; y: number } }
  | { kind: 'crop'; x: number; y: number; width: number; height: number; angle: number }
  | { kind: 'float'; raster: Raster; x: number; y: number; matrix?: Matrix }
  | { kind: 'source'; x: number; y: number }
  // The Eyedropper's ring: the colour it would take over the one held.
  | { kind: 'ring'; x: number; y: number; colour: string; was: string }
  | {
      kind: 'shape';
      shape: 'rectangle' | 'ellipse' | 'line';
      from: { x: number; y: number };
      to: { x: number; y: number };
    };

export type ToolCtx = {
  session: PhotoSession;
  state: () => PhotoToolState;
  toast: (message: string) => void;
  // A message with buttons the person may press (New Layer for a tool refused on a layer it cannot paint); a toast
  // without them where the host has none.
  offer?: (message: string, actions: { label: string; run: () => void }[]) => void;
  // Redraws the overlay (the tool's shapes) without touching the photo.
  setOverlay: (overlay: ToolOverlay) => void;
  // The text overlay's request: type into a text layer (`isNew`: just made by this press).
  editText?: (layerId: string, isNew?: boolean) => void;
};

export const rgbOf = (hex: string): [number, number, number] => hexToBytes(hex);

/** The whole photo's rect. */
export const photoRect = (photo: Photo): Rect => ({
  x: 0,
  y: 0,
  width: photo.width,
  height: photo.height,
});

/** The picture a sampling tool reads over `rect` (photo coordinates): the active layer's pixels, or
 *  the composite (All Layers). */
export function sampleRect(ctx: ToolCtx, all: boolean, rect: Rect): Raster {
  const s = ctx.session;
  const layer = s.layer(s.active);
  if (all || !layer || layer.layerKind !== 'pixel')
    return compositePhoto(s.photo, s.lookup(), rect, { text: rasterizeText });
  const o = layer.offset ?? { x: 0, y: 0 };
  return s
    .raster(layer.id)
    .read({ x: rect.x - o.x, y: rect.y - o.y, width: rect.width, height: rect.height });
}

/** The picture a sampling tool reads over the whole photo, in photo coordinates. */
export const samplePicture = (ctx: ToolCtx, all: boolean): Raster =>
  sampleRect(ctx, all, photoRect(ctx.session.photo));

/** Why a layer refuses a change of its pixels, if it does. */
export function pixelsRefused(
  layer: PhotoLayer | undefined,
  target: 'layer' | 'mask',
): string | null {
  if (!layer) return null;
  if (layer.visible === false) return `${layer.name} is hidden. Show it to paint on it.`;
  if (target === 'layer' && (layer.locks?.pixels || layer.locks?.all)) {
    shakeLock(layer.id);
    return `${layer.name} is locked.`;
  }
  return null;
}

// What a layer that holds no pixels is, for the refusal that names it.
const KIND_WORDS: Record<Exclude<PhotoLayer['layerKind'], 'pixel'>, string> = {
  text: 'a text layer',
  adjustment: 'an adjustment layer',
  fill: 'a fill layer',
  group: 'a group',
};

/** A tool that changes pixels refused on a layer with none (photo-tools.md "Painting and erasing"): it never makes a
 *  layer by itself. It says what the active layer is and offers New Layer, which makes one above it (the next press
 *  paints there). Null so the caller stops. */
export function refuseNoPixels(ctx: ToolCtx, layer: PhotoLayer | undefined): null {
  const message = layer
    ? `${layer.name} is ${KIND_WORDS[layer.layerKind as keyof typeof KIND_WORDS] ?? 'not a pixel layer'}. Choose a pixel layer, or add one.`
    : 'Choose a pixel layer to work on, or add one.';
  if (ctx.offer)
    ctx.offer(message, [
      {
        label: 'New Layer',
        run: () => {
          newPixelLayer(ctx);
          ctx.session.changed();
        },
      },
    ]);
  else ctx.toast(message);
  return null;
}

/**
 * The pixel layer a painting tool acts on: the active one when it is a pixel layer (or its mask, the
 * target). With any other layer active it refuses (refuseNoPixels), as it does with a locked or hidden one.
 */
export function paintTarget(
  ctx: ToolCtx,
): { layer: PixelLayer | PhotoLayer; target: 'layer' | 'mask' } | null {
  const s = ctx.session;
  const layer = s.layer(s.active);
  const target = s.target === 'mask' && layer?.mask ? 'mask' : 'layer';
  if (target === 'layer' && (!layer || layer.layerKind !== 'pixel'))
    return refuseNoPixels(ctx, layer);
  const refused = pixelsRefused(layer, target);
  if (refused) {
    ctx.toast(refused);
    return null;
  }
  return { layer: layer!, target };
}

/** A new empty pixel layer above the active one, made active (one edit). The session holds it at
 *  once, so what comes next paints onto it. */
export function newPixelLayer(ctx: ToolCtx, stem?: string): PixelLayer {
  const s = ctx.session;
  const made: PixelLayer = {
    id: newLayerId(s.photo.layers.map((l) => l.id)),
    name: nextLayerName(stem ?? layerNameStem({ layerKind: 'pixel' }), s.photo.layers),
    layerKind: 'pixel',
    pixels: { tiles: {} },
  };
  s.commitStack(addLayer(s.photo, made, s.active ?? undefined), 'New Layer');
  s.active = made.id;
  s.target = 'layer';
  return made;
}

/** Where a pixel layer's origin sits in the photo. */
export const offsetOf = (layer: PhotoLayer): { x: number; y: number } =>
  layer.layerKind === 'pixel' ? (layer.offset ?? { x: 0, y: 0 }) : { x: 0, y: 0 };

/** Where the target's pixels sit in the photo: a linked mask moves with its layer, an unlinked one
 *  has its own offset. */
export function targetOffset(
  layer: PhotoLayer,
  target: 'layer' | 'mask',
): { x: number; y: number } {
  if (target === 'mask' && layer.mask?.linked === false) return layer.mask.offset ?? { x: 0, y: 0 };
  return offsetOf(layer);
}

/** The layer's locked transparency (painting keeps each pixel's alpha). */
export const alphaLocked = (layer: PhotoLayer): boolean =>
  !!(layer.locks?.transparency || layer.locks?.all);

/** The selection in the layer's own coordinates, or null for everything. */
export const selectionOf = (ctx: ToolCtx): Mask8 | null => ctx.session.selection;
