// The Move tool (docs/specs/031-photo/photo-tools.md "Moving and transforming"): a drag moves the
// active layer (a group with everything in it), or, with a selection, lifts the selected pixels and
// puts them down where the drag ends, one edit. Shift keeps the drag level or upright, Alt moves a
// copy, Auto-Select picks the top layer with a pixel under the press, and arrows nudge 1 px (Shift 10).
import {
  descendantIds,
  duplicateLayers,
  maskBounds,
  translate,
  type Photo,
  type PhotoLayer,
} from '@livedesign/photo-engine';
import { extentOf } from '../layer-ops';
import type { PhotoSession } from '../session';
import { textBox } from '../text-raster';
import { lift, putDown, type Lifted } from './lift';
import { offsetOf, type PhotoPoint, type ToolCtx } from './tool-context';
import type { ToolHandler } from './tool-handler';
import { shakeLock } from '../lock-shake';

export type AlignHow = 'left' | 'centre' | 'right' | 'top' | 'middle' | 'bottom';
const ALIGN_LABEL: Record<AlignHow, string> = {
  left: 'Align Left',
  centre: 'Align Centres',
  right: 'Align Right',
  top: 'Align Top',
  middle: 'Align Middles',
  bottom: 'Align Bottom',
};

/** The Move tool's Align (photo-tools.md "Moving and transforming"): each layer in hand moved, whole
 *  px, so its edge or middle meets the selection's (or, with none, the photo's). A layer locked in
 *  place stays. One edit. */
export function alignLayers(s: PhotoSession, how: AlignHow): string | null {
  const to = (s.selection ? maskBounds(s.selection) : null) ?? {
    x: 0,
    y: 0,
    width: s.photo.width,
    height: s.photo.height,
  };
  let photo = s.photo;
  let locked: PhotoLayer | null = null;
  for (const id of s.inHand()) {
    const layer = photo.layers.find((l) => l.id === id);
    if (!layer) continue;
    if (layer.locks?.position || layer.locks?.all) {
      locked = layer;
      continue;
    }
    const b = extentOf(s, layer);
    if (!b) continue;
    const dx =
      how === 'left'
        ? to.x - b.x
        : how === 'centre'
          ? to.x + to.width / 2 - (b.x + b.width / 2)
          : how === 'right'
            ? to.x + to.width - (b.x + b.width)
            : 0;
    const dy =
      how === 'top'
        ? to.y - b.y
        : how === 'middle'
          ? to.y + to.height / 2 - (b.y + b.height / 2)
          : how === 'bottom'
            ? to.y + to.height - (b.y + b.height)
            : 0;
    photo = movedLayers(photo, movingIds(photo, layer), Math.round(dx), Math.round(dy));
  }
  if (photo !== s.photo) s.commitStack(photo, ALIGN_LABEL[how]);
  else if (locked) {
    shakeLock(locked.id);
    return `${locked.name} is locked.`;
  }
  return null;
}

/** The photo with these layers moved by whole px: a pixel layer's offset, a text layer's place. A
 *  linked mask moves with its layer; an unlinked one stays. */
export function movedLayers(photo: Photo, ids: ReadonlySet<string>, dx: number, dy: number): Photo {
  if (!dx && !dy) return photo;
  return {
    ...photo,
    layers: photo.layers.map((l) => {
      if (!ids.has(l.id)) return l;
      if (l.layerKind === 'pixel') {
        const o = offsetOf(l);
        return { ...l, offset: { x: o.x + dx, y: o.y + dy } };
      }
      if (l.layerKind === 'text')
        return { ...l, text: { ...l.text, at: { x: l.text.at.x + dx, y: l.text.at.y + dy } } };
      return l;
    }),
  };
}

/** The layer and everything a group holds. */
function movingIds(photo: Photo, layer: PhotoLayer): Set<string> {
  return new Set(
    layer.layerKind === 'group' ? [layer.id, ...descendantIds(photo.layers, layer.id)] : [layer.id],
  );
}

/** The top shown layer with a pixel under a point (Auto-Select). */
export function layerAt(s: PhotoSession, p: { x: number; y: number }): PhotoLayer | null {
  for (let i = s.photo.layers.length - 1; i >= 0; i--) {
    const l = s.photo.layers[i]!;
    if (!s.shown(l.id)) continue;
    if (l.layerKind === 'pixel') {
      const o = offsetOf(l);
      if (s.raster(l.id).sample(Math.floor(p.x - o.x), Math.floor(p.y - o.y), 3) > 0) return l;
    } else if (l.layerKind === 'text') {
      const b = textBox(l);
      if (p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height) return l;
    }
  }
  return null;
}

const locked = (l: PhotoLayer) => !!(l.locks?.position || l.locks?.all);

export function moveTool(ctx: ToolCtx): ToolHandler {
  let start: { x: number; y: number } | null = null;
  let base: Photo | null = null;
  let ids: Set<string> | null = null;
  let floating: Lifted | null = null;
  let copied = false;
  let delta = { x: 0, y: 0 };
  const deltaOf = (p: PhotoPoint) => {
    let dx = Math.round(p.x - start!.x);
    let dy = Math.round(p.y - start!.y);
    if (p.shift) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    return { x: dx, y: dy };
  };
  const reset = () => {
    start = null;
    base = null;
    ids = null;
    floating = null;
    copied = false;
    delta = { x: 0, y: 0 };
  };
  return {
    cursor: 'move',
    down(p) {
      const s = ctx.session;
      // Ctrl/Cmd flips Auto-Select for the press.
      if (ctx.state().options.move.autoSelect !== p.mod) {
        const hit = layerAt(s, p);
        if (hit) {
          // A layer picked outside the chosen ones is moved alone.
          if (!s.chosen.has(hit.id)) s.chosen = new Set();
          s.active = hit.id;
          s.target = 'layer';
          s.changed();
        }
      }
      let layer = s.layer(s.active);
      if (!layer) return false;
      const stuck = s
        .inHand()
        .map((id) => s.layer(id))
        .find((l) => l && locked(l));
      if (stuck) {
        shakeLock(stuck.id);
        ctx.toast(`${stuck.name} is locked.`);
        return false;
      }
      if (s.selection && layer.layerKind === 'pixel') {
        // Alt with a selection moves a copy of the pixels: the lift leaves them behind.
        floating = lift(s, layer, s.selection);
        if (!floating) {
          ctx.toast('Nothing selected on this layer to move.');
          return false;
        }
        if (p.alt) s.restorePixels(layer.id, 'layer', floating.before.clone());
        start = { x: p.x, y: p.y };
        ctx.setOverlay({
          kind: 'float',
          raster: floating.raster,
          x: floating.x,
          y: floating.y,
          matrix: translate(0, 0),
        });
        return true;
      }
      if (p.alt) {
        // A copy is moved; the copy and its move are one edit.
        s.checkpoint();
        const { photo, copies } = duplicateLayers(s.photo, [layer.id]);
        s.commitStack(photo, 'Duplicate', { undoable: false });
        s.active = copies[0] ?? layer.id;
        layer = s.layer(s.active) ?? layer;
        copied = true;
      }
      start = { x: p.x, y: p.y };
      base = s.photo;
      // The chosen layers move together (an Alt copy alone).
      const hand = copied ? [layer.id] : s.inHand();
      ids = new Set(
        hand.flatMap((id) => {
          const l = base!.layers.find((x) => x.id === id);
          return l ? [...movingIds(base!, l)] : [];
        }),
      );
      return true;
    },
    move(p) {
      if (!start) return;
      delta = deltaOf(p);
      if (floating) {
        ctx.setOverlay({
          kind: 'float',
          raster: floating.raster,
          x: floating.x,
          y: floating.y,
          matrix: translate(delta.x, delta.y),
        });
        return;
      }
      if (base && ids) ctx.session.preview(movedLayers(base, ids, delta.x, delta.y));
    },
    up(p) {
      if (!start) return;
      delta = deltaOf(p);
      const s = ctx.session;
      if (floating) {
        ctx.setOverlay({ kind: 'none' });
        // A press that never moved changes nothing.
        if (!delta.x && !delta.y && !p.alt)
          s.restorePixels(floating.layerId, 'layer', floating.before);
        else putDown(s, floating, translate(delta.x, delta.y), 'Move');
      } else if (base && ids) {
        const next = movedLayers(base, ids, delta.x, delta.y);
        if (next !== base) s.commitStack(next, 'Move', copied ? { undoable: false } : undefined);
        else s.preview(base);
        // The copy and its move were one step.
        if (copied) s.endGesture();
      }
      reset();
    },
    key(key, e) {
      const step = e.shift ? 10 : 1;
      const d =
        key === 'ArrowLeft'
          ? { x: -step, y: 0 }
          : key === 'ArrowRight'
            ? { x: step, y: 0 }
            : key === 'ArrowUp'
              ? { x: 0, y: -step }
              : key === 'ArrowDown'
                ? { x: 0, y: step }
                : null;
      if (!d) return false;
      const s = ctx.session;
      const layer = s.layer(s.active);
      if (!layer || locked(layer)) return true;
      if (s.selection && layer.layerKind === 'pixel') {
        const lifted = lift(s, layer, s.selection);
        if (lifted) putDown(s, lifted, translate(d.x, d.y), 'Nudge');
        return true;
      }
      s.commitStack(movedLayers(s.photo, movingIds(s.photo, layer), d.x, d.y), 'Nudge');
      return true;
    },
    cancel() {
      const s = ctx.session;
      if (floating) {
        ctx.setOverlay({ kind: 'none' });
        s.restorePixels(floating.layerId, 'layer', floating.before);
      } else if (base) s.preview(base);
      reset();
    },
  };
}
