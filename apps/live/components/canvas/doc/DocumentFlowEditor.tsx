'use client';

// One document's writing (docs/specs/007-editor/document-pages.md): a ProseMirror editor laid over
// the document's pages in canvas space, its text in columns, one a page, so the browser breaks
// lines between pages and wraps text round floated zones. It owns the text while someone types:
// what they type is written to the tab when they pause (DOC_IDLE_COMMIT_MS), leave the writing, or
// do anything that is not typing; what changes on the tab from elsewhere (a collaborator's blocks,
// an undo) is merged in block by block, so neither loses the other. After every change it measures
// where the writing reaches (how many pages, where each zone landed) and reports it, so the host
// can add or remove pages and move zones' elements (useDocumentPages).
import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import {
  EditorState,
  NodeSelection,
  Selection,
  TextSelection,
  type Command,
  type Transaction,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import type { Node as PMNode } from 'prosemirror-model';
import { gapCursor } from 'prosemirror-gapcursor';
import {
  applyDocOps,
  diffDocFlow,
  nextDocBlockId,
  docWordCount,
  type DocBlock,
  type DocFlow,
  type LaidOutPage,
} from '@livediagram/document';
import { blocksToDoc, docToBlocks } from '@/lib/doc/doc-convert';
import { docKeymap, docInputRules } from '@/lib/doc/doc-keys';
import { blockIdsPlugin, decorationsPlugin, todoTogglePlugin } from '@/lib/doc/doc-plugins';
import { insertBlocksAfterCaret, selectionStateOf } from '@/lib/doc/doc-commands';
import {
  clearActiveDoc,
  registerDocHandle,
  setActiveDoc,
  type DocEditorHandle,
} from '@/lib/doc/doc-editor-store';
import { docSchema } from '@/lib/doc/doc-schema';
import { columnAt, flowFrame, pagePlaceOf } from '@/lib/doc/doc-flow-geometry';
import { docStyleVars, type DocInk } from '@/lib/doc/doc-style-vars';
import { debugLog } from '@/lib/debug-log';

// How long typing pauses before it is written to the tab (docs/specs/007-editor/document-pages.md
// "Writing", "Commits").
export const DOC_IDLE_COMMIT_MS = 600;
// How long after a local change this person still counts as the writer of its consequences.
const WRITER_WINDOW_MS = 3000;

export type FlowLayout = {
  flow: string;
  // How many pages the writing reaches.
  pagesNeeded: number;
  // Where each zone landed: its page (by index among the document's pages) and its top-left from
  // that page's corner, and its size, in canvas px.
  zones: { id: string; index: number; x: number; y: number; width: number; height: number }[];
  // Whether this person made the change that laid it out (only they settle its consequences).
  local: boolean;
};

export type FocusRequest = { flow: string; at: 'start' | 'end'; seq: number } | null;

export type DocumentFlowEditorProps = {
  flow: string;
  // The document's pages, laid out, in order.
  pages: LaidOutPage[];
  doc: DocFlow;
  editable: boolean;
  // Whether a press on the writing is the writing's (not while a drawing tool is in hand).
  interactive: boolean;
  zoom: number;
  ink: DocInk;
  themeAccent: string;
  margin: number;
  // The writing's blocks, written to the tab (one undo step, one sync).
  onCommit: (flow: string, blocks: DocBlock[]) => void;
  onLayout: (layout: FlowLayout) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLinkRequest: () => void;
  // A press on the writing: the canvas's selection goes.
  onWritingPress: () => void;
  focusRequest: FocusRequest;
};

export default function DocumentFlowEditor(props: DocumentFlowEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // The writing as last written to or read from the tab: the base local typing is measured from.
  const committed = useRef<DocFlow>(props.doc);
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });
  const idle = useRef<number | null>(null);
  const lastLocal = useRef(0);
  const measureFrame = useRef<number | null>(null);
  // Set while an undo or redo from the writing is under way: the change it brings back takes the
  // caret.
  const undoing = useRef(false);

  // Everything below reads the view through the ref; created once, below.
  const flush = () => {
    const view = viewRef.current;
    if (idle.current !== null) {
      window.clearTimeout(idle.current);
      idle.current = null;
    }
    if (!view) return;
    const blocks = docToBlocks(view.state.doc, committed.current.blocks);
    if (blocks === committed.current.blocks) return;
    committed.current = { ...committed.current, blocks };
    latest.current.onCommit(latest.current.flow, blocks);
  };
  const scheduleCommit = () => {
    if (idle.current !== null) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(flush, DOC_IDLE_COMMIT_MS);
  };

  const measure = () => {
    measureFrame.current = null;
    const view = viewRef.current;
    const p = latest.current;
    if (!view || p.pages.length === 0) return;
    const frame = flowFrame(p.pages, p.margin);
    const root = view.dom.getBoundingClientRect();
    const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
    let right = 0;
    for (const child of Array.from(view.dom.children)) {
      for (const r of Array.from(child.getClientRects())) {
        if (r.width === 0 && r.height === 0) continue;
        right = Math.max(right, (r.left - root.left) / z + 1);
      }
    }
    const pagesNeeded = columnAt(frame, Math.max(0, right - 2)) + 1;
    const zones: FlowLayout['zones'] = [];
    view.dom.querySelectorAll<HTMLElement>('.doc-zone').forEach((el) => {
      const r = el.getBoundingClientRect();
      const place = pagePlaceOf(frame, { x: (r.left - root.left) / z, y: (r.top - root.top) / z });
      zones.push({
        id: el.dataset.blockId ?? '',
        index: place.index,
        x: Math.round(place.x * 2) / 2,
        y: Math.round(place.y * 2) / 2,
        width: r.width / z,
        height: r.height / z,
      });
    });
    const local = Date.now() - lastLocal.current < WRITER_WINDOW_MS || view.hasFocus();
    p.onLayout({ flow: p.flow, pagesNeeded, zones, local });
  };
  const scheduleMeasure = () => {
    if (measureFrame.current !== null) return;
    measureFrame.current = requestAnimationFrame(measure);
  };

  // The page the caret is on, by the column its screen spot falls in.
  const caretPage = (view: EditorView): string | null => {
    const p = latest.current;
    try {
      const at = view.coordsAtPos(view.state.selection.head);
      const root = view.dom.getBoundingClientRect();
      const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
      const col = columnAt(flowFrame(p.pages, p.margin), (at.left - root.left) / z);
      return p.pages[Math.min(col, p.pages.length - 1)]?.id ?? null;
    } catch {
      return p.pages[0]?.id ?? null;
    }
  };

  const handleRef = useRef<DocEditorHandle | null>(null);
  const publish = (view: EditorView) => {
    if (!view.hasFocus() || !handleRef.current) return;
    setActiveDoc({
      handle: handleRef.current,
      pageId: caretPage(view),
      selection: selectionStateOf(view.state),
    });
  };

  useLayoutEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const isEditable = () => latest.current.editable;
    const state = EditorState.create({
      doc: blocksToDoc(committed.current.blocks),
      plugins: [
        ...docKeymap({
          undo: () => {
            flush();
            undoing.current = true;
            latest.current.onUndo();
          },
          redo: () => {
            flush();
            undoing.current = true;
            latest.current.onRedo();
          },
          onLink: () => latest.current.onLinkRequest(),
          onEscape: () => {
            flush();
            (viewRef.current?.dom as HTMLElement | undefined)?.blur();
          },
        }),
        docInputRules(),
        blockIdsPlugin,
        decorationsPlugin(isEditable),
        todoTogglePlugin(isEditable),
        gapCursor(),
      ],
    });
    const view = new EditorView(mount, {
      state,
      editable: isEditable,
      attributes: () => {
        const p = latest.current;
        const frame = flowFrame(p.pages, p.margin);
        const { vars, rules } = docStyleVars(p.doc.style, p.themeAccent, p.ink);
        const style: CSSProperties = {
          ...vars,
          left: `${frame.x}px`,
          top: `${frame.y}px`,
          width: `${frame.width}px`,
          height: `${frame.height}px`,
        };
        const css = Object.entries(style)
          .map(
            ([k, v]) =>
              `${k.startsWith('--') ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v}`,
          )
          .join('; ');
        return {
          class: 'doc-flow',
          style: `${css}; column-count: ${frame.count}; column-gap: ${frame.gap}px`,
          'data-rules': rules,
          'data-doc-flow': p.flow,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Document text',
          spellcheck: 'true',
          ...(p.editable ? {} : { 'data-readonly': '', 'aria-readonly': 'true' }),
          ...(p.interactive ? {} : { 'data-inert': '' }),
        };
      },
      // The canvas is not a scrolling page: ProseMirror must never scroll its ancestors.
      handleScrollToSelection: () => true,
      dispatchTransaction(tr: Transaction) {
        const v = viewRef.current;
        if (!v) return;
        v.updateState(v.state.apply(tr));
        if (tr.docChanged) {
          if (!tr.getMeta('doc-remote')) {
            lastLocal.current = Date.now();
            scheduleCommit();
          }
          scheduleMeasure();
        }
        publish(v);
      },
      handleDOMEvents: {
        focus: (v) => {
          publish(v);
          return false;
        },
        blur: (v) => {
          flush();
          // The toolbar and its popovers keep the document active while focus is in them.
          window.setTimeout(() => {
            const el = document.activeElement;
            if (v.hasFocus() || (el instanceof HTMLElement && el.closest('[data-doc-keep-active]')))
              return;
            clearActiveDoc(latest.current.flow);
          }, 0);
          return false;
        },
      },
    });
    viewRef.current = view;
    // A handle for driving the writing in development (browser checks); never in production.
    if (process.env.NODE_ENV !== 'production')
      (window as unknown as { __docView?: EditorView }).__docView = view;
    handleRef.current = {
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
      undo: () => {
        flush();
        undoing.current = true;
        latest.current.onUndo();
        view.focus();
      },
      redo: () => {
        flush();
        undoing.current = true;
        latest.current.onRedo();
        view.focus();
      },
      focus: () => view.focus(),
      caretRect: () => {
        try {
          const c = view.coordsAtPos(view.state.selection.head);
          return new DOMRect(c.left, c.top, 1, c.bottom - c.top);
        } catch {
          return null;
        }
      },
      insertZone: (spec, near) => {
        const p = latest.current;
        const frame = flowFrame(p.pages, p.margin);
        const root = view.dom.getBoundingClientRect();
        const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
        const doc = view.state.doc;
        const ids = new Set<string>();
        doc.forEach((n) => ids.add(n.attrs.id as string));
        const id = nextDocBlockId(ids);
        const node = docSchema.nodes.zone!.create({ id, ...spec });
        // The block boundary nearest the point: before the block it is in when it is in that
        // block's upper half, else after it; with no point, after the caret's block.
        let at = doc.content.size;
        const blockAt = (at: number) => {
          const $p = doc.resolve(Math.min(at, doc.content.size));
          return $p.depth >= 1 ? { start: $p.before(1), end: $p.after(1) } : null;
        };
        if (near) {
          // By the blocks' own boxes (an element dropped over the writing covers the point, so a
          // hit test there finds the element): the block whose box (in the point's column) is
          // nearest the point, before it when the point is in its upper half.
          const left = root.left + (near.x - frame.x) * z;
          const top = root.top + (near.y - frame.y) * z;
          let best: { pos: number; size: number; before: boolean; d: number } | null = null;
          let pos = 0;
          doc.forEach((node) => {
            const dom = view.nodeDOM(pos) as HTMLElement | null;
            for (const r of dom ? Array.from(dom.getClientRects()) : []) {
              if (left < r.left - 24 * z || left > r.right + 24 * z) continue;
              const d = top < r.top ? r.top - top : top > r.bottom ? top - r.bottom : 0;
              if (!best || d < best.d)
                best = { pos, size: node.nodeSize, before: top < r.top + r.height / 2, d };
            }
            pos += node.nodeSize;
          });
          const found = best as { pos: number; size: number; before: boolean } | null;
          if (found) at = found.before ? found.pos : found.pos + found.size;
        } else {
          const block = blockAt(view.state.selection.from);
          if (block) at = block.end;
        }
        const tr = view.state.tr.insert(at, node);
        // Always somewhere to write after it.
        if (at + node.nodeSize >= tr.doc.content.size)
          tr.insert(tr.doc.content.size, docSchema.nodes.paragraph!.create());
        tr.setSelection(NodeSelection.create(tr.doc, at));
        view.dispatch(tr);
        const el = view.dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const place = pagePlaceOf(frame, {
          x: (r.left - root.left) / z,
          y: (r.top - root.top) / z,
        });
        // Taken as written: the host writes these blocks, the zone placed, in one edit.
        const blocks = docToBlocks(view.state.doc, committed.current.blocks);
        committed.current = { ...committed.current, blocks };
        if (idle.current !== null) {
          window.clearTimeout(idle.current);
          idle.current = null;
        }
        lastLocal.current = Date.now();
        return {
          id,
          blocks,
          index: place.index,
          x: Math.round(place.x * 2) / 2,
          y: Math.round(place.y * 2) / 2,
        };
      },
      caretCanvasPoint: () => {
        const p = latest.current;
        try {
          const c = view.coordsAtPos(view.state.selection.head);
          const frame = flowFrame(p.pages, p.margin);
          const root = view.dom.getBoundingClientRect();
          const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
          return { x: frame.x + (c.left - root.left) / z, y: frame.y + (c.top - root.top) / z };
        } catch {
          return null;
        }
      },
      words: () => {
        const blocks = docToBlocks(view.state.doc, committed.current.blocks);
        const { from, to, empty } = view.state.selection;
        const selected = empty
          ? 0
          : (view.state.doc.textBetween(from, to, ' ', ' ').match(/\S+/g) ?? []).length;
        return { total: docWordCount(blocks), selected };
      },
    };
    const unregister = registerDocHandle(handleRef.current);
    scheduleMeasure();
    // Web fonts arriving change every line's length.
    const fonts = document.fonts;
    const onFonts = () => scheduleMeasure();
    fonts?.addEventListener?.('loadingdone', onFonts);
    debugLog('[doc] writing mounted', { flow: latest.current.flow });
    return () => {
      fonts?.removeEventListener?.('loadingdone', onFonts);
      unregister();
      if (measureFrame.current !== null) cancelAnimationFrame(measureFrame.current);
      measureFrame.current = null;
      flush();
      view.destroy();
      viewRef.current = null;
      clearActiveDoc(latest.current.flow);
    };
    // Created once per document: everything it reads is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The writing changed on the tab from elsewhere (a collaborator, an undo, a zone settled): merge
  // it in, keeping what this person typed since the last commit (their blocks win where both
  // changed one, as the commit that follows will say).
  useLayoutEffect(() => {
    const view = viewRef.current;
    const incoming = props.doc;
    if (!view || incoming === committed.current) return;
    const base = committed.current;
    const local = docToBlocks(view.state.doc, base.blocks);
    const localOps =
      local === base.blocks
        ? []
        : diffDocFlow(base, { blocks: local }).filter((op) => op.kind !== 'style');
    const merged = localOps.length > 0 ? applyDocOps(incoming, localOps).blocks : incoming.blocks;
    committed.current = incoming;
    replaceContent(view, merged, undoing.current);
    undoing.current = false;
    if (localOps.length > 0) scheduleCommit();
    view.setProps({});
    scheduleMeasure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.doc]);

  // Pages, zoom, style or rights changed: the box, its columns and its look follow.
  useLayoutEffect(() => {
    viewRef.current?.setProps({});
    scheduleMeasure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.pages,
    props.zoom,
    props.ink,
    props.themeAccent,
    props.margin,
    props.editable,
    props.interactive,
  ]);

  // A request to put the caret in this document (a new document: its title).
  const request = props.focusRequest;
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !request || request.flow !== props.flow || !props.editable) return;
    const sel =
      request.at === 'start' ? Selection.atStart(view.state.doc) : Selection.atEnd(view.state.doc);
    view.dispatch(view.state.tr.setSelection(sel));
    view.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.seq]);

  return (
    <div
      ref={host}
      // Not positioned: the writing's box places itself on the canvas.
      style={{ display: 'contents' }}
      // A press in the writing is the writing's: no marquee, no pan, no element press beneath.
      onPointerDown={(e) => {
        if (!latest.current.interactive) return;
        if (!(e.target as HTMLElement).closest?.('.doc-flow > *')) return;
        e.stopPropagation();
        latest.current.onWritingPress();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
    />
  );
}

// The editor's content made `blocks`, replacing only the blocks between the first and the last that
// differ, so a caret in an untouched block stays exactly where it is. An undo's change puts the
// caret at the end of what it changed.
function replaceContent(view: EditorView, blocks: readonly DocBlock[], takeCaret: boolean): void {
  const next = blocksToDoc(blocks);
  const doc = view.state.doc;
  const start = doc.content.findDiffStart(next.content);
  if (start === null) return;
  const end = doc.content.findDiffEnd(next.content)!;
  // findDiffEnd answers for both documents; keep the two ends ordered for the replace.
  let { a: endA, b: endB } = end;
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }
  const tr = view.state.tr.replace(start, endA, next.slice(start, endB));
  tr.setMeta('doc-remote', true).setMeta('addToHistory', false);
  if (takeCaret) {
    const at = Math.min(tr.doc.content.size, Math.max(0, endB));
    tr.setSelection(TextSelection.near(tr.doc.resolve(at), -1));
  }
  view.dispatch(tr);
}
