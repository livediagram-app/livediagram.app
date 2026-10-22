// The Select menu (docs/specs/031-photo/photo-tools.md "Selecting", "Smart selections"): All,
// Deselect, Reselect, Inverse, Subject, Colour Range, Modify (Grow, Expand, Contract, Border, Smooth,
// Feather) and Remove Background. A selection is the session's, never an edit; Remove Background is.
import {
  borderMask,
  colourRange,
  combineMasks,
  compositeAll,
  contractMask,
  createMask,
  expandMask,
  featherMask,
  floodSelect,
  invertMask,
  maskBounds,
  compositePhoto,
  resizeRaster,
  smoothMask,
  TiledRaster,
  setLayer,
  type Mask8,
} from '@livedesign/photo-engine';
import { addMask, setSelection } from './mask-ops';
import { photoWorkers } from './photo-worker-client';
import type { PhotoSession } from './session';
import { refineMask, withinZone, type MaskRefine } from './select-and-mask';
import { rasterizeText } from './text-raster';

// Subject works on the composite at up to this many px on its longer side (photo-tools.md).
export const SUBJECT_WORK_SIDE = 1024;
// The boundary band re-decided at full size after the subject is scaled up, px.
export const SUBJECT_REFINE_RADIUS = 6;

const whole = (s: PhotoSession) => ({ x: 0, y: 0, width: s.photo.width, height: s.photo.height });

export function selectAll(s: PhotoSession): void {
  setSelection(s, createMask(whole(s), 255));
}

export function deselect(s: PhotoSession): void {
  setSelection(s, null);
}

export function reselect(s: PhotoSession): void {
  if (s.lastSelection) setSelection(s, s.lastSelection);
}

export function inverse(s: PhotoSession): void {
  setSelection(s, invertMask(s.selection, whole(s)));
}

export type ModifyHow = 'expand' | 'contract' | 'border' | 'smooth' | 'feather';

export function modifySelection(s: PhotoSession, how: ModifyHow, px: number): string | null {
  const m = s.selection;
  if (!m) return 'Make a selection first.';
  const next =
    how === 'expand'
      ? expandMask(m, px)
      : how === 'contract'
        ? contractMask(m, px)
        : how === 'border'
          ? borderMask(m, px)
          : how === 'smooth'
            ? smoothMask(m, px)
            : featherMask(m, px);
  setSelection(s, next);
  return null;
}

/** Grow: the like-coloured neighbours of the selection joined to it, by the wand's tolerance. */
export function grow(s: PhotoSession, tolerance: number): string | null {
  const m = s.selection;
  const b = m ? maskBounds(m) : null;
  if (!m || !b) return 'Make a selection first.';
  const pic = compositeAll(s.photo, s.lookup(), { text: rasterizeText });
  let next: Mask8 | null = m;
  // Seeded from a few points inside the selection: its centre and its bounds' middles.
  const seeds = [
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
    { x: b.x + 1, y: b.y + b.height / 2 },
    { x: b.x + b.width - 2, y: b.y + b.height / 2 },
    { x: b.x + b.width / 2, y: b.y + 1 },
    { x: b.x + b.width / 2, y: b.y + b.height - 2 },
  ];
  for (const p of seeds) {
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    const mx = x - m.x;
    const my = y - m.y;
    if (mx < 0 || my < 0 || mx >= m.width || my >= m.height || m.data[my * m.width + mx]! < 128)
      continue;
    next = combineMasks(next, floodSelect(pic, x, y, { tolerance, contiguous: true }), 'add');
  }
  setSelection(s, next);
  return null;
}

/** Colour Range: every pixel by its closeness to the picked colours. */
export function selectColourRange(
  s: PhotoSession,
  colours: readonly (readonly number[])[],
  fuzziness: number,
): Mask8 {
  const pic = compositeAll(s.photo, s.lookup(), { text: rasterizeText });
  return colourRange(pic, colours, fuzziness);
}

/** Subject: GrabCut on the composite (or `layerId`'s pixels) at the work size, scaled up, its
 *  boundary re-decided at full size and feathered 1 px. */
export async function subjectMask(s: PhotoSession, layerId?: string): Promise<Mask8 | null> {
  const { width: W, height: H } = s.photo;
  const layer = layerId ? s.layer(layerId) : undefined;
  const pic =
    layer?.layerKind === 'pixel'
      ? s
          .raster(layer.id)
          .read({ x: -(layer.offset?.x ?? 0), y: -(layer.offset?.y ?? 0), width: W, height: H })
      : compositeAll(s.photo, s.lookup(), { text: rasterizeText });
  const k = Math.min(1, SUBJECT_WORK_SIDE / Math.max(W, H));
  const small =
    k < 1
      ? resizeRaster(
          pic,
          Math.max(1, Math.round(W * k)),
          Math.max(1, Math.round(H * k)),
          'bilinear',
        )
      : pic;
  const res = await photoWorkers().run({ kind: 'subject', raster: small }).result;
  if (res.kind !== 'mask') return null;
  // The small mask as a grey picture, scaled up.
  const grey = new Uint8ClampedArray(small.width * small.height * 4);
  for (let i = 0; i < res.mask.length; i++) {
    const v = res.mask[i]! ? 255 : 0;
    grey[i * 4] = v;
    grey[i * 4 + 3] = 255;
  }
  const big =
    k < 1
      ? resizeRaster({ width: small.width, height: small.height, data: grey }, W, H, 'bilinear')
      : { width: W, height: H, data: grey };
  let mask = createMask(whole(s));
  for (let i = 0; i < mask.data.length; i++) mask.data[i] = big.data[i * 4]!;
  if (k < 1) {
    const refined = await photoWorkers().run({
      kind: 'refine',
      raster: pic,
      mask,
      radius: SUBJECT_REFINE_RADIUS,
    }).result;
    if (refined.kind === 'selection') mask = refined.selection;
  }
  return featherMask(mask, 1) ?? mask;
}

export async function selectSubject(s: PhotoSession): Promise<string | null> {
  const m = await subjectMask(s);
  if (!m || !maskBounds(m)) return 'No subject found.';
  setSelection(s, m);
  return null;
}

/** Remove Background: Subject on the active pixel layer, made its mask (hiding the rest). One edit. */
export async function removeBackground(s: PhotoSession): Promise<string | null> {
  const layer = s.layer(s.active);
  if (!layer || layer.layerKind !== 'pixel')
    return 'Choose a pixel layer to remove its background.';
  if (layer.mask) return `${layer.name} already has a mask. Delete it first.`;
  const m = await subjectMask(s, layer.id);
  if (!m || !maskBounds(m)) return 'No subject found.';
  const o = layer.offset ?? { x: 0, y: 0 };
  const mask = new TiledRaster(1, 255);
  mask.writeChannel({ x: m.x - o.x, y: m.y - o.y, width: m.width, height: m.height }, m.data);
  s.replacePixels(layer.id, 'mask', mask);
  s.target = 'mask';
  s.commitPixels('Remove Background', [{ layerId: layer.id, target: 'mask' }], (p) =>
    p.layers.find((l) => l.id === layer.id)?.mask
      ? p
      : setLayer(p, layer.id, { mask: { pixels: { tiles: {} } } }),
  );
  return null;
}

// Refine Edge's reach either side of the edge, px at full size.
export const REFINE_EDGE_RADIUS = 6;

/** Select and Mask's OK: the selection worked by its settings, re-decided by colour inside the painted
 *  zone (only the zone's own area composited, at full size), then kept as the selection or made the
 *  active layer's mask. */
export async function applySelectAndMask(
  s: PhotoSession,
  r: MaskRefine,
  zone: Mask8 | null,
  output: 'selection' | 'mask',
): Promise<string | null> {
  const m = s.selection;
  if (!m) return 'Make a selection first.';
  let next = refineMask(m, r);
  const zb = zone ? maskBounds(zone) : null;
  if (zone && zb) {
    const pad = REFINE_EDGE_RADIUS * 4;
    const rect = {
      x: Math.max(0, zb.x - pad),
      y: Math.max(0, zb.y - pad),
      width: 0,
      height: 0,
    };
    rect.width = Math.min(s.photo.width, zb.x + zb.width + pad) - rect.x;
    rect.height = Math.min(s.photo.height, zb.y + zb.height + pad) - rect.y;
    if (rect.width > 0 && rect.height > 0) {
      const pic = compositePhoto(s.photo, s.lookup(), rect, { text: rasterizeText });
      // The selection in the area's own px, refined there, and put back.
      const local = { ...next, x: next.x - rect.x, y: next.y - rect.y };
      const res = await photoWorkers().run({
        kind: 'refine',
        raster: pic,
        mask: local,
        radius: REFINE_EDGE_RADIUS,
      }).result;
      if (res.kind === 'selection') {
        const refined = {
          ...res.selection,
          x: res.selection.x + rect.x,
          y: res.selection.y + rect.y,
        };
        next = withinZone(next, refined, zone);
      }
    }
  }
  setSelection(s, next);
  if (output === 'selection') return null;
  const layer = s.layer(s.active);
  if (!layer) return 'Choose a layer for the mask.';
  const refused = addMask(s, layer.id, 'selection');
  if (refused) return refused;
  setSelection(s, null);
  return null;
}
