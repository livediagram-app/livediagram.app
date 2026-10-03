'use client';

// One article's writing (docs/specs/007-editor/article-pages.md): a ProseMirror editor laid over
// the article's pages in canvas space, its text in columns, one a page, so the browser breaks
// lines between pages and wraps text round floated zones. It owns the text while someone types:
// what they type is written to the tab when they pause (ARTICLE_IDLE_COMMIT_MS), leave the writing, or
// do anything that is not typing; what changes on the tab from elsewhere (a collaborator's blocks,
// an undo) is merged in block by block, so neither loses the other. After every change it measures
// where the writing reaches (how many pages, where each zone landed) and reports it, so the host
// can add or remove pages and move zones' elements (useArticles).
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  EditorState,
  Selection,
  NodeSelection,
  TextSelection,
  type Command,
  type Transaction,
} from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Slice, type Node as PMNode } from 'prosemirror-model';
import {
  looksLikeMarkdown,
  parseMarkdownBlocks,
  plainTextBlocks,
} from '@/lib/article/article-markdown';
import { track } from '@/lib/telemetry';
import { gapCursor } from 'prosemirror-gapcursor';
import {
  applyArticleOps,
  diffArticleFlow,
  nextArticleBlockId,
  type ArticleBlock,
  type ArticleFlow,
  type LaidOutPage,
} from '@livediagram/document';
import { blocksToDoc, docToBlocks } from '@/lib/article/article-convert';
import type { ArticleNotePlace } from '@livediagram/document';
import { articleKeymap, articleInputRules } from '@/lib/article/article-keys';
import { blockIdsPlugin, decorationsPlugin, todoTogglePlugin } from '@/lib/article/article-plugins';
import { insertBlocksAfterCaret, selectionStateOf } from '@/lib/article/article-commands';
import {
  clearActiveArticle,
  registerArticleHandle,
  setActiveArticle,
  requestArticleComment,
  blurActiveArticle,
  type ArticleEditorHandle,
} from '@/lib/article/article-editor-store';
import { articleSchema } from '@/lib/article/article-schema';
import { columnAt, flowFrame, pagePlaceOf } from '@/lib/article/article-flow-geometry';
import { articleStyleVars, type ArticleInk } from '@/lib/article/article-style-vars';
import { snapshotBars, snapshotWriting } from '@/lib/article/article-snapshot';
import { removeSlashQuery, slashPlugin, type SlashBridge } from '@/lib/article/article-slash';
import { filterSlashItems, type SlashItem } from '@/lib/article/article-slash-items';
import { setBlockStyle, toggleList } from '@/lib/article/article-commands';
import { SlashMenu } from './SlashMenu';
import type { ArticleInsert } from '@/hooks/editor/useArticles';
import { debugLog } from '@/lib/debug-log';

// How long typing pauses before it is written to the tab (docs/specs/007-editor/article-pages.md
// "Writing", "Commits").
export const ARTICLE_IDLE_COMMIT_MS = 600;
// How long after a local change this person still counts as the writer of its consequences.
const WRITER_WINDOW_MS = 3000;

export type FlowLayout = {
  flow: string;
  // How many pages the writing reaches.
  pagesNeeded: number;
  // Where each zone landed: its page (by index among the article's pages) and its top-left from
  // that page's corner, and its size, in canvas px.
  zones: { id: string; index: number; x: number; y: number; width: number; height: number }[];
  // Where each margin note's text starts: its first line's page, top and height.
  notes: ArticleNotePlace[];
  // Whether this person made the change that laid it out (only they settle its consequences).
  local: boolean;
};

export type FocusRequest = { flow: string; at: 'start' | 'end'; seq: number } | null;

export type ArticleEditorProps = {
  flow: string;
  // The article's pages, laid out, in order.
  pages: LaidOutPage[];
  doc: ArticleFlow;
  editable: boolean;
  // Whether a press on the writing is the writing's (not while a drawing tool is in hand).
  interactive: boolean;
  zoom: number;
  ink: ArticleInk;
  themeAccent: string;
  margin: number;
  // A style shown in place of the article's own while a Style tab choice is hovered.
  styleOverride?: ArticleFlow['style'];
  // The writing's blocks, written to the tab (one undo step, one sync).
  onCommit: (flow: string, blocks: ArticleBlock[]) => void;
  onLayout: (layout: FlowLayout) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLinkRequest: () => void;
  // An object put in at the caret (the slash menu): a table, a chart, a drawing...
  onInsert: (flow: string, what: ArticleInsert) => void;
  // A press on the writing: the canvas's selection goes.
  onWritingPress: () => void;
  focusRequest: FocusRequest;
};

export default function ArticleEditor(props: ArticleEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // The writing as last written to or read from the tab: the base local typing is measured from.
  const committed = useRef<ArticleFlow>(props.doc);
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
  // The slash menu: open with its query and where the `/` is, and the entry highlighted.
  const [slash, setSlash] = useState<{
    query: string;
    at: { left: number; top: number; bottom: number };
  } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashItems = slash ? filterSlashItems(slash.query) : [];
  const slashLive = useRef({ items: slashItems, index: slashIndex });
  useLayoutEffect(() => {
    slashLive.current = { items: slashItems, index: slashIndex };
  });
  const pickSlash = (item: SlashItem) => {
    const view = viewRef.current;
    if (!view) return;
    removeSlashQuery(view);
    setSlash(null);
    const a = item.action;
    if (a.kind === 'style') setBlockStyle(a.style)(view.state, view.dispatch, view);
    else if (a.kind === 'list') toggleList(a.list)(view.state, view.dispatch, view);
    else if (a.kind === 'block')
      insertBlocksAfterCaret(
        a.block === 'divider'
          ? [articleSchema.nodes.divider!.create()]
          : [articleSchema.nodes.page_break!.create(), articleSchema.nodes.paragraph!.create()],
      )(view.state, view.dispatch, view);
    else latest.current.onInsert(latest.current.flow, a.what);
    view.focus();
  };
  const pickSlashRef = useRef(pickSlash);
  useLayoutEffect(() => {
    pickSlashRef.current = pickSlash;
  });

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
    idle.current = window.setTimeout(flush, ARTICLE_IDLE_COMMIT_MS);
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
    view.dom.querySelectorAll<HTMLElement>('.article-zone').forEach((el) => {
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
    const notes: ArticleNotePlace[] = [];
    const seen = new Set<string>();
    view.dom.querySelectorAll<HTMLElement>('[data-note-id]').forEach((el) => {
      const id = el.dataset.noteId ?? '';
      const r = el.getClientRects()[0];
      if (!id || seen.has(id) || !r) return;
      seen.add(id);
      const place = pagePlaceOf(frame, { x: (r.left - root.left) / z, y: (r.top - root.top) / z });
      notes.push({ id, index: place.index, y: place.y, height: r.height / z });
    });
    const local = Date.now() - lastLocal.current < WRITER_WINDOW_MS || view.hasFocus();
    p.onLayout({ flow: p.flow, pagesNeeded, zones, notes, local });
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

  const handleRef = useRef<ArticleEditorHandle | null>(null);
  const publish = (view: EditorView) => {
    if (!view.hasFocus() || !handleRef.current) return;
    setActiveArticle({
      handle: handleRef.current,
      pageId: caretPage(view),
      selection: selectionStateOf(view.state),
      focused: true,
    });
  };

  useLayoutEffect(() => {
    const mount = host.current;
    if (!mount) return;
    const isEditable = () => latest.current.editable;
    const bridge: SlashBridge = {
      onChange: (s, v) => {
        if (!s.active) {
          setSlash(null);
          return;
        }
        try {
          const c = v.coordsAtPos(s.from);
          setSlash((prev) => {
            if (prev?.query !== s.query) setSlashIndex(0);
            return { query: s.query, at: { left: c.left, top: c.top, bottom: c.bottom } };
          });
        } catch {
          setSlash(null);
        }
      },
      onKey: (key) => {
        const { items, index } = slashLive.current;
        if (items.length === 0) return false;
        if (key === 'down') setSlashIndex((index + 1) % items.length);
        else if (key === 'up') setSlashIndex((index - 1 + items.length) % items.length);
        else if (key === 'enter') pickSlashRef.current(items[index] ?? items[0]!);
        return true;
      },
    };
    const state = EditorState.create({
      doc: blocksToDoc(committed.current.blocks),
      plugins: [
        // First, so its keys come before Enter's and the arrows'.
        slashPlugin(bridge),
        ...articleKeymap({
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
          onComment: () => requestArticleComment(),
          onEscape: () => {
            flush();
            (viewRef.current?.dom as HTMLElement | undefined)?.blur();
          },
        }),
        articleInputRules(),
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
        const { vars, rules } = articleStyleVars(
          p.styleOverride ?? p.doc.style,
          p.themeAccent,
          p.ink,
        );
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
          class: 'article-flow',
          style: `${css}; column-count: ${frame.count}; column-gap: ${frame.gap}px`,
          'data-rules': rules,
          'data-article-flow': p.flow,
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': 'Article text',
          spellcheck: 'true',
          ...(p.editable ? {} : { 'data-readonly': '', 'aria-readonly': 'true' }),
          ...(p.interactive ? {} : { 'data-inert': '' }),
        };
      },
      // The canvas is not a scrolling page: ProseMirror must never scroll its ancestors.
      handleScrollToSelection: () => true,
      // Pasted text (docs/specs/007-editor/article-pages.md "Writing", Paste): Markdown becomes
      // the blocks it means, several lines of plain text a paragraph each, its first and last
      // joining the text around the caret. Into code, or a single plain line: as typed.
      clipboardTextParser: (text, $context) => {
        if ($context.parent.type.spec.code) return undefined as unknown as Slice;
        const markdown = looksLikeMarkdown(text);
        if (!markdown && !text.includes('\n')) return undefined as unknown as Slice;
        const blocks = markdown ? parseMarkdownBlocks(text) : plainTextBlocks(text);
        if (blocks.length === 0) return undefined as unknown as Slice;
        if (markdown) track('Element', 'Changed', 'ArticlePaste');
        const doc = blocksToDoc(blocks);
        const first = doc.firstChild!;
        const last = doc.lastChild!;
        return new Slice(doc.content, first.isTextblock ? 1 : 0, last.isTextblock ? 1 : 0);
      },
      // Into an empty block, pasted text comes whole: the block gives its place to the pasted
      // blocks, the first keeping its own style (a heading stays a heading).
      handlePaste: (v, event) => {
        const data = event.clipboardData;
        if (!data || data.types.includes('text/html')) return false;
        const text = data.getData('text/plain');
        const { $from, empty } = v.state.selection;
        if (!empty || $from.depth < 1 || $from.parent.content.size > 0) return false;
        if ($from.parent.type.spec.code) return false;
        const markdown = looksLikeMarkdown(text);
        if (!markdown && !text.includes('\n')) return false;
        const blocks = markdown ? parseMarkdownBlocks(text) : plainTextBlocks(text);
        if (blocks.length === 0) return false;
        const nodes: PMNode[] = [];
        blocksToDoc(blocks).forEach((n) => nodes.push(n));
        const start = $from.before(1);
        const tr = v.state.tr.replaceWith(start, $from.after(1), nodes);
        const end = start + nodes.reduce((n, node) => n + node.nodeSize, 0);
        tr.setSelection(Selection.near(tr.doc.resolve(end), -1)).setMeta('uiEvent', 'paste');
        v.dispatch(tr.scrollIntoView());
        if (markdown) track('Element', 'Changed', 'ArticlePaste');
        return true;
      },
      dispatchTransaction(tr: Transaction) {
        const v = viewRef.current;
        if (!v) return;
        v.updateState(v.state.apply(tr));
        if (tr.docChanged) {
          if (!tr.getMeta('article-remote')) {
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
          // The article stays active (its page keeps its toolbar) until a press lands off its
          // pages (PageToolbar); only the focus goes.
          window.setTimeout(() => {
            if (!v.hasFocus()) blurActiveArticle(latest.current.flow);
          }, 0);
          return false;
        },
      },
    });
    viewRef.current = view;
    // A handle for driving the writing in development (browser checks); never in production.
    if (process.env.NODE_ENV !== 'production') Reflect.set(window, '__docView', view);
    // Canvas px per screen px of the writing, and the writing's frame on the canvas.
    const scaleAndFrame = () => {
      const p = latest.current;
      const frame = flowFrame(p.pages, p.margin);
      const root = view.dom.getBoundingClientRect();
      const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
      return { frame, root, z };
    };
    // The block boundary nearest a canvas point, by the blocks' own boxes (an element dragged over
    // the writing covers the point, so a hit test there finds the element): the block whose box (in
    // the point's column) is nearest, before it when the point is in its upper half. With the drop
    // caret for it: a line across the column at the boundary, in canvas px. A block named `skipId`
    // (the zone being moved) is never a neighbour.
    const boundaryNear = (near: { x: number; y: number }, skipId: string | null) => {
      const { frame, root, z } = scaleAndFrame();
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
      const { frame, root, z } = scaleAndFrame();
      const el = view.dom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(id)}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const place = pagePlaceOf(frame, { x: (r.left - root.left) / z, y: (r.top - root.top) / z });
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
    };
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
      selection: () => selectionStateOf(view.state),
      caretRect: () => {
        try {
          const c = view.coordsAtPos(view.state.selection.head);
          return new DOMRect(c.left, c.top, 1, c.bottom - c.top);
        } catch {
          return null;
        }
      },
      blocksByPage: () => {
        const { frame, root, z } = scaleAndFrame();
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
        const { frame, root, z } = scaleAndFrame();
        const el = view.dom.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`);
        const r = el?.getClientRects()[0];
        if (!r) return null;
        const place = pagePlaceOf(frame, {
          x: (r.left - root.left) / z,
          y: (r.top - root.top) / z,
        });
        // Taken as written: the host writes these blocks and the marker in one edit.
        const blocks = docToBlocks(view.state.doc, committed.current.blocks);
        committed.current = { ...committed.current, blocks };
        if (idle.current !== null) {
          window.clearTimeout(idle.current);
          idle.current = null;
        }
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
        const found = boundaryNear(near, id);
        if (!node || !found) return null;
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
        const p = latest.current;
        const frame = flowFrame(p.pages, p.margin);
        const root = view.dom.getBoundingClientRect();
        const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
        return snapshotWriting(
          view.dom,
          (x, y) => ({ x: frame.x + (x - root.left) / z, y: frame.y + (y - root.top) / z }),
          z,
        );
      },
      bars: (ink: string) => {
        const p = latest.current;
        const frame = flowFrame(p.pages, p.margin);
        const root = view.dom.getBoundingClientRect();
        const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
        return snapshotBars(
          view.dom,
          (x, y) => ({ x: frame.x + (x - root.left) / z, y: frame.y + (y - root.top) / z }),
          z,
          ink,
        );
      },
      focusAt: (clientX: number, clientY: number) => {
        const p = latest.current;
        const frame = flowFrame(p.pages, p.margin);
        const root = view.dom.getBoundingClientRect();
        const z = root.width / Math.max(1, view.dom.offsetWidth) || p.zoom;
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
    };
    const unregister = registerArticleHandle(handleRef.current);
    scheduleMeasure();
    // Web fonts arriving change every line's length.
    const fonts = document.fonts;
    const onFonts = () => scheduleMeasure();
    fonts?.addEventListener?.('loadingdone', onFonts);
    debugLog('[article] writing mounted', { flow: latest.current.flow });
    return () => {
      fonts?.removeEventListener?.('loadingdone', onFonts);
      unregister();
      if (measureFrame.current !== null) cancelAnimationFrame(measureFrame.current);
      measureFrame.current = null;
      flush();
      view.destroy();
      viewRef.current = null;
      clearActiveArticle(latest.current.flow);
    };
    // Created once per article: everything it reads is read through refs.
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
        : diffArticleFlow(base, { blocks: local }).filter((op) => op.kind !== 'style');
    const merged =
      localOps.length > 0 ? applyArticleOps(incoming, localOps).blocks : incoming.blocks;
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
    props.styleOverride,
  ]);

  // A request to put the caret in this article (a new article: its title).
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
    <>
      {slash && props.editable ? (
        <SlashMenu
          at={slash.at}
          items={slashItems}
          index={Math.min(slashIndex, Math.max(0, slashItems.length - 1))}
          onPick={pickSlash}
          onHover={setSlashIndex}
        />
      ) : null}
      <div
        ref={host}
        // Not positioned: the writing's box places itself on the canvas.
        style={{ display: 'contents' }}
        // A press in the writing is the writing's: no marquee, no pan, no element press beneath.
        onPointerDown={(e) => {
          if (!latest.current.interactive) return;
          if (!(e.target as HTMLElement).closest?.('.article-flow > *')) return;
          e.stopPropagation();
          latest.current.onWritingPress();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      />
    </>
  );
}

// The editor's content made `blocks`, replacing only the blocks between the first and the last that
// differ, so a caret in an untouched block stays exactly where it is. An undo's change puts the
// caret at the end of what it changed.
function replaceContent(
  view: EditorView,
  blocks: readonly ArticleBlock[],
  takeCaret: boolean,
): void {
  const next = blocksToDoc(blocks);
  const doc = view.state.doc;
  const start = doc.content.findDiffStart(next.content);
  if (start === null) return;
  const end = doc.content.findDiffEnd(next.content)!;
  // findDiffEnd answers for both articles; keep the two ends ordered for the replace.
  let { a: endA, b: endB } = end;
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }
  const tr = view.state.tr.replace(start, endA, next.slice(start, endB));
  tr.setMeta('article-remote', true).setMeta('addToHistory', false);
  if (takeCaret) {
    const at = Math.min(tr.doc.content.size, Math.max(0, endB));
    tr.setSelection(TextSelection.near(tr.doc.resolve(at), -1));
  }
  view.dispatch(tr);
}
