// A photo's changes as ops (docs/specs/031-photo/photo-store.md "Live sync"): what changed from one
// photo to the next, layer by layer, and applying them by layer id so two people changing different
// layers both keep their changes, and the later commit wins on the same layer.
import { isBlobId } from './ids';
import { PHOTO_PIXEL_CAP } from './limits';
import { parseLayer } from './parse';
import { normaliseStack } from './stack';
import type { Photo, PhotoLayer, PhotoOp } from './types';

const same = (a: PhotoLayer, b: PhotoLayer) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** The ops from `before` to `after` (`before` absent: everything is new). */
export function diffPhoto(before: Photo | undefined, after: Photo): PhotoOp[] {
  const ops: PhotoOp[] = [];
  if (!before || before.width !== after.width || before.height !== after.height)
    ops.push({ op: 'size', width: after.width, height: after.height });
  const was = new Map((before?.layers ?? []).map((l) => [l.id, l]));
  const now = new Set(after.layers.map((l) => l.id));
  for (const l of before?.layers ?? []) if (!now.has(l.id)) ops.push({ op: 'remove', id: l.id });
  after.layers.forEach((l, i) => {
    const prev = was.get(l.id);
    if (prev && same(prev, l)) return;
    ops.push({ op: 'put', layer: l, after: i > 0 ? after.layers[i - 1]!.id : null });
  });
  const beforeOrder = (before?.layers ?? []).map((l) => l.id).filter((id) => now.has(id));
  const afterOrder = after.layers.map((l) => l.id).filter((id) => was.has(id));
  if (beforeOrder.join() !== afterOrder.join())
    ops.push({ op: 'order', ids: after.layers.map((l) => l.id) });
  if ((before?.preview ?? null) !== (after.preview ?? null))
    ops.push({ op: 'preview', blob: after.preview ?? null });
  return ops;
}

/** `ids` as the stack's order, any layer they do not name kept after the named layer it followed
 *  (or first, when none came before it). */
function reorder(layers: readonly PhotoLayer[], ids: readonly string[]): PhotoLayer[] {
  const byId = new Map(layers.map((l) => [l.id, l]));
  const named = ids.filter((id) => byId.has(id));
  const namedSet = new Set(named);
  // Each unnamed layer rides behind the nearest named layer under it in the current order.
  const riders = new Map<string | null, PhotoLayer[]>();
  let lastNamed: string | null = null;
  for (const l of layers) {
    if (namedSet.has(l.id)) {
      lastNamed = l.id;
      continue;
    }
    const list = riders.get(lastNamed) ?? [];
    list.push(l);
    riders.set(lastNamed, list);
  }
  const out: PhotoLayer[] = [...(riders.get(null) ?? [])];
  for (const id of named) {
    out.push(byId.get(id)!);
    out.push(...(riders.get(id) ?? []));
  }
  return out;
}

/** The photo with the ops applied in order. */
export function applyPhotoOps(photo: Photo, ops: readonly PhotoOp[]): Photo {
  let next: Photo = photo;
  for (const op of ops) {
    switch (op.op) {
      case 'size':
        next = { ...next, width: op.width, height: op.height };
        break;
      case 'put': {
        const at = next.layers.findIndex((l) => l.id === op.layer.id);
        if (at >= 0) {
          const layers = [...next.layers];
          layers[at] = op.layer;
          next = { ...next, layers };
          break;
        }
        const under = op.after ? next.layers.findIndex((l) => l.id === op.after) : -1;
        const layers = [...next.layers];
        if (op.after === null) layers.unshift(op.layer);
        else if (under >= 0) layers.splice(under + 1, 0, op.layer);
        else layers.push(op.layer);
        next = { ...next, layers };
        break;
      }
      case 'remove': {
        if (!next.layers.some((l) => l.id === op.id)) break;
        // A removed group takes its layers with it.
        const gone = new Set([op.id]);
        for (let i = next.layers.length - 1; i >= 0; i--) {
          const l = next.layers[i]!;
          if (l.parent && gone.has(l.parent)) gone.add(l.id);
        }
        next = { ...next, layers: next.layers.filter((l) => !gone.has(l.id)) };
        break;
      }
      case 'order':
        next = { ...next, layers: reorder(next.layers, op.ids) };
        break;
      case 'preview': {
        if (op.blob) next = { ...next, preview: op.blob };
        else {
          const { preview: _drop, ...rest } = next;
          void _drop;
          next = rest;
        }
        break;
      }
    }
  }
  return next === photo ? photo : { ...next, layers: normaliseStack(next.layers) };
}

// The most ops one frame is read with.
const MAX_OPS = 1000;

/** The ops a frame carries, read defensively: undefined when any is malformed (the receiver
 *  changes nothing). */
export function parsePhotoOps(v: unknown): PhotoOp[] | undefined {
  if (!Array.isArray(v) || v.length > MAX_OPS) return undefined;
  const out: PhotoOp[] = [];
  for (const raw of v) {
    if (typeof raw !== 'object' || raw === null) return undefined;
    const o = raw as Record<string, unknown>;
    switch (o.op) {
      case 'size': {
        const w = o.width;
        const h = o.height;
        if (
          typeof w !== 'number' ||
          typeof h !== 'number' ||
          !Number.isInteger(w) ||
          !Number.isInteger(h) ||
          w < 1 ||
          h < 1 ||
          w > PHOTO_PIXEL_CAP ||
          h > PHOTO_PIXEL_CAP
        )
          return undefined;
        out.push({ op: 'size', width: w, height: h });
        break;
      }
      case 'put': {
        const layer = parseLayer(o.layer);
        if (!layer) return undefined;
        const after = o.after === null ? null : typeof o.after === 'string' ? o.after : undefined;
        out.push({ op: 'put', layer, ...(after !== undefined ? { after } : {}) });
        break;
      }
      case 'remove':
        if (typeof o.id !== 'string') return undefined;
        out.push({ op: 'remove', id: o.id });
        break;
      case 'order':
        if (!Array.isArray(o.ids) || !o.ids.every((id) => typeof id === 'string')) return undefined;
        out.push({ op: 'order', ids: o.ids });
        break;
      case 'preview':
        if (o.blob !== null && !isBlobId(o.blob)) return undefined;
        out.push({ op: 'preview', blob: o.blob });
        break;
      default:
        return undefined;
    }
  }
  return out;
}
