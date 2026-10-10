// The handle a mounted article's writing is driven by (lib/article/article-editor-store): the page
// toolbar's commands, the zone and note edits that write the writing and its objects in one step,
// and the reads that turn the writing's boxes on screen into canvas points (snapshots, the drop
// caret, the Map's bars). Built once per writing by ArticleEditor, over its refs.
import type { MutableRefObject } from 'react';
import { NodeSelection, Selection, TextSelection, type Command } from 'prosemirror-state';
import type { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import {
  nextArticleBlockId,
  type ArticleBlock,
  type ArticleFlow,
  type LaidOutPage,
} from '@livediagram/document';
import { docToBlocks } from '@/lib/article/article-convert';
import { insertBlocksAfterCaret, selectionStateOf } from '@/lib/article/article-commands';
import type { ArticleEditorHandle } from '@/lib/article/article-editor-store';
import { articleSchema } from '@/lib/article/article-schema';
import { columnAt, flowFrame, pagePlaceOf } from '@/lib/article/article-flow-geometry';
import { snapshotBars, snapshotWriting, type ArticleDrawOp } from '@/lib/article/article-snapshot';

// What the writing is laid out over, as ArticleEditor's props hold it.
type WritingLayout = { flow: string; pages: LaidOutPage[]; margin: number; zoom: number };

/**
 * The writing's frame on the canvas, its box on screen, and screen px per canvas px (read off the
 * box, so it holds mid-zoom; the zoom only when the writing is not laid out).
 */
export function writingScale(view: EditorView, p: WritingLayout) {
  const frame = flowFrame(p.pages, p.margin);
  const root = view.dom.getBoundingClientRect();
  const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
  return { frame, root, z };
}

export function createArticleHandle({
  view,
  latest,
  committed,
  idle,
  lastLocal,
  barsCache,
  flush,
  undoRedo,
}: {
  view: EditorView;
  latest: MutableRefObject<WritingLayout>;
  committed: MutableRefObject<ArticleFlow>;
  idle: MutableRefObject<number | null>;
  lastLocal: MutableRefObject<number>;
  barsCache: MutableRefObject<{ ink: string; ops: ArticleDrawOp[] } | null>;
  flush: () => void;
  // An undo or redo asked for from the writing.
  undoRedo: (which: 'undo' | 'redo') => void;
}): ArticleEditorHandle {
  const scale = () => writingScale(view, latest.current);
  // A screen point, as a canvas point, by one read of the writing's scale.
  const toCanvas = ({ frame, root, z }: ReturnType<typeof scale>) => {
    return (x: number, y: number) => ({
      x: frame.x + (x - root.left) / z,
      y: frame.y + (y - root.top) / z,
    });
  };
  // The writing taken as written now: the host writes these blocks itself (with what goes with
  // them, in one edit), so no idle commit follows.
  const takeBlocks = (): ArticleBlock[] => {
    const blocks = docToBlocks(view.state.doc, committed.current.blocks);
    committed.current = { ...committed.current, blocks };
    if (idle.current !== null) {
      window.clearTimeout(idle.current);
      idle.current = null;
    }
    return blocks;
  };
  // The block boundary nearest a canvas point, by the blocks' own boxes (an element dragged over
  // the writing covers the point, so a hit test there finds the element): the block whose box (in
  // the point's column) is nearest, before it when the point is in its upper half. With the drop
  // caret for it: a line across the column at the boundary, in canvas px. A block named `skipId`
  // (the zone being moved) is never a neighbour.
  const boundaryNear = (near: { x: number; y: number }, skipId: string | null) => {
    const { frame, root, z } = scale();
    const left = root.left + (near.x - frame.x) * z;
    const top = root.top + (near.y - frame.y) * z;
    let best: { pos: number; size: number; before: boolean; d: number; r: DOMRect } | null = null;
    let pos = 0;
    view.state.doc.forEach((node) => {
      const dom = view.nodeDOM(pos) as HTMLElement | null;
      if (node.attrs.id !== skipId)
        for (const r of dom ? Array.from(dom.getClientRects()) : []) {
          if (left < r.left - 24 * z || left > r.right + 24 * z) continue;
          const d = top < r.top ? r.top - top : top > r.bottom ? top - r.bottom : 0;
          if (!best || d < best.d)
            best = { pos, size: node.nodeSize, before: top < r.top + r.height / 2, d, r };
        }
      pos += node.nodeSize;
    });
    const found = best as { pos: number; size: number; before: boolean; r: DOMRect } | null;
    if (!found) return null;
    // The caret spans the column the block sits in.
    const index = columnAt(frame, (found.r.left - root.left) / z);
    return {
      pos: found.before ? found.pos : found.pos + found.size,
      caret: {
        x: frame.x + index * frame.stride,
        y: frame.y + ((found.before ? found.r.top : found.r.bottom) - root.top) / z,
        width: frame.columnWidth,
      },
    };
  };
  // Where a zone now in the writing landed, the writing taken as written: the host writes these
  // blocks, the zone placed, in one edit.
  const landedOf = (id: string) => {
    const { frame, root, z } = scale();
    const el = view.dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const place = pagePlaceOf(frame, { x: (r.left - root.left) / z, y: (r.top - root.top) / z });
    const blocks = takeBlocks();
    lastLocal.current = Date.now();
    return {
      id,
      blocks,
      index: place.index,
      x: Math.round(place.x * 2) / 2,
      y: Math.round(place.y * 2) / 2,
    };
  };

  return {
    flow: latest.current.flow,
    run: (command: Command) => {
      const ok = command(view.state, view.dispatch, view);
      view.focus();
      return ok;
    },
    can: (command: Command) => command(view.state, undefined, view),
    insert: (nodes: PMNode[]) => {
      insertBlocksAfterCaret(nodes)(view.state, view.dispatch, view);
      view.focus();
    },
    flush,
    takeBlocks,
    undo: () => {
      undoRedo('undo');
      view.focus();
    },
    redo: () => {
      undoRedo('redo');
      view.focus();
    },
    focus: () => view.focus(),
    selection: () => selectionStateOf(view.state),
    claimLayout: () => {
      lastLocal.current = Date.now();
    },
    caretRect: () => {
      try {
        const c = view.coordsAtPos(view.state.selection.head);
        return new DOMRect(c.left, c.top, 1, c.bottom - c.top);
      } catch {
        return null;
      }
    },
    blocksByPage: () => {
      const { frame, root, z } = scale();
      const out: string[][] = latest.current.pages.map(() => []);
      let pos = 0;
      view.state.doc.forEach((node) => {
        const r = (view.nodeDOM(pos) as HTMLElement | null)?.getClientRects()[0];
        const index = r
          ? Math.min(out.length - 1, columnAt(frame, (r.left - root.left) / z))
          : out.length - 1;
        out[Math.max(0, index)]?.push(node.attrs.id as string);
        pos += node.nodeSize;
      });
      return out;
    },
    markNote: (id, kind) => {
      const { from, to, empty } = view.state.selection;
      if (empty) return null;
      const mark = articleSchema.marks.note!.create({ id, kind });
      view.dispatch(view.state.tr.addMark(from, to, mark));
      const { frame, root, z } = scale();
      const el = view.dom.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`);
      const r = el?.getClientRects()[0];
      if (!r) return null;
      const place = pagePlaceOf(frame, {
        x: (r.left - root.left) / z,
        y: (r.top - root.top) / z,
      });
      // Taken as written: the host writes these blocks and the marker in one edit.
      const blocks = takeBlocks();
      lastLocal.current = Date.now();
      return { blocks, place: { id, index: place.index, y: place.y, height: r.height / z } };
    },
    boundaryNear: (near, skipId) => {
      const found = boundaryNear(near, skipId);
      return found ? { pos: found.pos, caret: found.caret } : null;
    },
    moveZone: (id, near) => {
      const doc = view.state.doc;
      let from = -1;
      doc.forEach((n, pos) => {
        if (n.attrs.id === id && n.type === articleSchema.nodes.zone) from = pos;
      });
      const node = from >= 0 ? doc.nodeAt(from) : null;
      const found =
        'by' in near ? { pos: zoneStepTarget(doc, from, near.by) } : boundaryNear(near, id);
      if (!node || !found || found.pos === null) return null;
      // Dropped where it already is: nothing moves.
      if (found.pos === from || found.pos === from + node.nodeSize) return null;
      const tr = view.state.tr.delete(from, from + node.nodeSize);
      const at = tr.mapping.map(found.pos);
      tr.insert(at, node);
      tr.setSelection(NodeSelection.create(tr.doc, at));
      view.dispatch(tr);
      return landedOf(id);
    },
    insertZone: (spec, near) => {
      const doc = view.state.doc;
      const ids = new Set<string>();
      doc.forEach((n) => ids.add(n.attrs.id as string));
      const id = nextArticleBlockId(ids);
      const node = articleSchema.nodes.zone!.create({ id, ...spec });
      // The block boundary nearest the point; with no point, after the caret's block.
      let at = doc.content.size;
      const blockAt = (at: number) => {
        const $p = doc.resolve(Math.min(at, doc.content.size));
        return $p.depth >= 1 ? { start: $p.before(1), end: $p.after(1) } : null;
      };
      if (near) {
        const found = boundaryNear(near, null);
        if (found) at = found.pos;
      } else {
        const block = blockAt(view.state.selection.from);
        if (block) at = block.end;
      }
      // An empty paragraph beside the boundary, with the caret in it, gives its place up.
      const caretBlock = blockAt(view.state.selection.from);
      const emptyAt = (start: number) => {
        const n = doc.nodeAt(start);
        return n?.type === articleSchema.nodes.paragraph && n.content.size === 0 ? n : null;
      };
      let replaceTo = at;
      if (caretBlock && view.state.selection.empty) {
        const n = emptyAt(caretBlock.start);
        if (n && (caretBlock.end === at || caretBlock.start === at)) {
          at = caretBlock.start;
          replaceTo = caretBlock.end;
        }
      }
      const tr = view.state.tr.replaceWith(at, replaceTo, node);
      // Always somewhere to write after it; the caret goes there, so writing carries on below.
      if (at + node.nodeSize >= tr.doc.content.size)
        tr.insert(tr.doc.content.size, articleSchema.nodes.paragraph!.create());
      tr.setSelection(TextSelection.near(tr.doc.resolve(at + node.nodeSize + 1)));
      view.dispatch(tr);
      return landedOf(id);
    },
    snapshot: () => {
      const s = scale();
      return snapshotWriting(view.dom, toCanvas(s), s.z);
    },
    bars: (ink: string) => {
      // One walk of the writing per layout, whoever asks (the Map, every slide thumbnail).
      if (barsCache.current?.ink === ink) return barsCache.current.ops;
      const s = scale();
      const ops = snapshotBars(view.dom, toCanvas(s), s.z, ink);
      barsCache.current = { ink, ops };
      return ops;
    },
    focusAt: (clientX: number, clientY: number) => {
      const { frame, root, z } = scale();
      // Into the text column of the page pressed, then to the nearest place in the writing.
      const col = columnAt(frame, (clientX - root.left) / z);
      const colLeft = root.left + col * frame.stride * z;
      const x = Math.max(colLeft + 1, Math.min(clientX, colLeft + frame.columnWidth * z - 1));
      const y = Math.max(root.top + 1, Math.min(clientY, root.bottom - 1));
      const hit = view.posAtCoords({ left: x, top: y });
      // Below the writing (nothing laid out there): the end of the writing.
      const pos = hit?.pos ?? view.state.doc.content.size;
      view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(pos))));
      view.focus();
    },
    caretCanvasPoint: () => {
      try {
        const c = view.coordsAtPos(view.state.selection.head);
        return toCanvas(scale())(c.left, c.top);
      } catch {
        return null;
      }
    },
  };
}

/**
 * Where a zone at `from` lands when stepped one block up (`by` -1, before the block above it) or
 * down (1, after the block below it): a position in the writing, or null at either end. The
 * keyboard's way to move a zone (the zone bar's grip, arrow keys), as a drag moves it by a point.
 */
export function zoneStepTarget(doc: PMNode, from: number, by: -1 | 1): number | null {
  if (from < 0) return null;
  let index = -1;
  let pos = 0;
  const starts: number[] = [];
  doc.forEach((n, p, i) => {
    starts.push(p);
    if (p === from) index = i;
    pos = p + n.nodeSize;
  });
  starts.push(pos);
  if (index < 0) return null;
  const target = by < 0 ? index - 1 : index + 2;
  if (target < 0 || target >= starts.length) return null;
  return starts[target]!;
}
