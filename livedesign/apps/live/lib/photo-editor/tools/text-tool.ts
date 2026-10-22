// The Text tool (docs/specs/031-photo/photo-tools.md "Text"): a press makes a text layer at the press,
// a drag one with a box that wraps at its width; on a text layer, a press edits it and a drag moves it. The typing is
// one edit: a checkpoint at its start, each change written without its own step, and an edit that
// leaves the text empty removes the layer (cancelling the checkpoint when the layer was new).
import {
  addLayer,
  newLayerId,
  nextLayerName,
  removeLayers,
  setLayer,
  textLayerName,
  type TextLayer,
  type TextSpec,
} from '@livedesign/photo-engine';
import type { PhotoSession } from '../session';
import { textBox } from '../text-raster';
import type { ToolCtx } from './tool-context';
import type { ToolHandler } from './tool-handler';

// A drag shorter than this (photo px) is a press: no box.
export const TEXT_BOX_MIN = 8;
// A drag on a text layer shorter than this (screen px) is a press: it edits rather than moves.
export const TEXT_MOVE_MIN_PX = 4;

/** The topmost shown text layer under a point. */
export function textLayerAt(s: PhotoSession, p: { x: number; y: number }): TextLayer | null {
  for (let i = s.photo.layers.length - 1; i >= 0; i--) {
    const l = s.photo.layers[i]!;
    if (l.layerKind !== 'text' || !s.shown(l.id)) continue;
    const b = textBox(l);
    if (p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height) return l;
  }
  return null;
}

/** An edit of one text layer's words and look, live on the photo until it ends. */
export type TextEdit = {
  layerId: string;
  spec: () => TextSpec;
  change: (patch: Partial<TextSpec>) => void;
  end: () => void;
};

export function beginTextEdit(s: PhotoSession, layerId: string, isNew: boolean): TextEdit | null {
  const layer = s.layer(layerId);
  if (!layer || layer.layerKind !== 'text') return null;
  if (layer.locks?.all) return null;
  const before = layer.text;
  if (!isNew) s.checkpoint();
  let ended = false;
  const spec = () => {
    const l = s.layer(layerId);
    return l?.layerKind === 'text' ? l.text : before;
  };
  return {
    layerId,
    spec,
    change(patch) {
      if (ended) return;
      s.commitStack(setLayer(s.photo, layerId, { text: { ...spec(), ...patch } }), 'Text', {
        undoable: false,
      });
    },
    end() {
      if (ended) return;
      ended = true;
      const now = spec();
      if (!now.text.trim()) {
        // An empty text layer is removed as its edit ends.
        s.commitStack(removeLayers(s.photo, [layerId]), 'Text', { undoable: false });
        if (isNew) s.cancelCheckpoint();
        else s.endGesture();
        return;
      }
      if (!isNew && JSON.stringify(now) === JSON.stringify(before)) {
        s.cancelCheckpoint();
        return;
      }
      // A layer still under its own name ("Text 1", or the words it had) takes its words; one renamed keeps it.
      const layer = s.layer(layerId);
      const auto =
        /^Text \d+$/.test(layer?.name ?? '') || layer?.name === textLayerName(before.text);
      const named = textLayerName(now.text);
      if (layer && auto && layer.name !== named)
        s.commitStack(setLayer(s.photo, layerId, { name: named }), 'Text', { undoable: false });
      s.endGesture();
    },
  };
}

export function textTool(ctx: ToolCtx): ToolHandler {
  let start: { x: number; y: number } | null = null;
  // A press on a text layer: edited on release, or moved once the drag goes far enough.
  let onText: { id: string; from: { x: number; y: number }; at: { x: number; y: number } } | null =
    null;
  let moved = false;
  return {
    cursor: 'text',
    down(p) {
      const s = ctx.session;
      const hit = textLayerAt(s, p);
      if (hit) {
        s.active = hit.id;
        s.target = 'layer';
        s.changed();
        if (hit.locks?.position || hit.locks?.all) {
          ctx.editText?.(hit.id);
          return false;
        }
        onText = { id: hit.id, from: { x: p.x, y: p.y }, at: hit.text.at };
        moved = false;
        return true;
      }
      start = { x: p.x, y: p.y };
      ctx.setOverlay({ kind: 'rect', x: p.x, y: p.y, width: 0, height: 0, ellipse: false });
      return true;
    },
    move(p) {
      if (onText) {
        const dx = Math.round(p.x - onText.from.x);
        const dy = Math.round(p.y - onText.from.y);
        if (!moved && Math.hypot(dx, dy) * p.scale < TEXT_MOVE_MIN_PX) return;
        const s = ctx.session;
        const layer = s.layer(onText.id);
        if (layer?.layerKind !== 'text') return;
        if (!moved) s.checkpoint();
        moved = true;
        const at = { x: onText.at.x + dx, y: onText.at.y + dy };
        s.commitStack(setLayer(s.photo, onText.id, { text: { ...layer.text, at } }), 'Move', {
          undoable: false,
        });
        return;
      }
      if (!start) return;
      ctx.setOverlay({
        kind: 'rect',
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        width: Math.abs(p.x - start.x),
        height: Math.abs(p.y - start.y),
        ellipse: false,
      });
    },
    up(p) {
      if (onText) {
        const { id } = onText;
        onText = null;
        // A drag moved it (one edit); a press edits it.
        if (moved) ctx.session.endGesture();
        else ctx.editText?.(id);
        moved = false;
        return;
      }
      ctx.setOverlay({ kind: 'none' });
      if (!start) return;
      const s = ctx.session;
      const st = ctx.state();
      const o = st.options.text;
      const span = Math.abs(p.x - start.x);
      const wide = span >= TEXT_BOX_MIN;
      const at = wide ? { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y) } : start;
      start = null;
      const layer: TextLayer = {
        id: newLayerId(s.photo.layers.map((l) => l.id)),
        name: nextLayerName('Text', s.photo.layers),
        layerKind: 'text',
        text: {
          text: '',
          font: o.font,
          size: o.size,
          weight: o.weight,
          ...(o.italic ? { italic: true as const } : {}),
          colour: st.foreground,
          align: o.align,
          lineHeight: o.lineHeight,
          tracking: o.tracking,
          at: { x: Math.round(at.x), y: Math.round(at.y) },
          ...(wide ? { boxWidth: Math.round(span) } : {}),
        },
      };
      s.checkpoint();
      s.commitStack(addLayer(s.photo, layer, s.active ?? undefined), 'Text', { undoable: false });
      s.active = layer.id;
      s.target = 'layer';
      ctx.editText?.(layer.id, true);
    },
    key(key) {
      if (key !== 'Escape' || !start) return false;
      start = null;
      ctx.setOverlay({ kind: 'none' });
      return true;
    },
    cancel() {
      start = null;
      ctx.setOverlay({ kind: 'none' });
    },
  };
}
