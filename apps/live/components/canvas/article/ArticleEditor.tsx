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
  MAX_ILLUSTRATE_PAGES,
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
import {
  insertBlocksAfterCaret,
  sameSelectionState,
  selectionStateOf,
  type ArticleSelectionState,
} from '@/lib/article/article-commands';
import {
  clearActiveArticle,
  registerArticleHandle,
  setActiveArticle,
  getActiveArticle,
  requestArticleComment,
  blurActiveArticle,
  type ArticleEditorHandle,
} from '@/lib/article/article-editor-store';
import { articleSchema } from '@/lib/article/article-schema';
import { columnAt, flowFrame, pagePlaceOf } from '@/lib/article/article-flow-geometry';
import { articleStyleVars, type ArticleInk } from '@/lib/article/article-style-vars';
import { snapshotBars, snapshotWriting, type ArticleDrawOp } from '@/lib/article/article-snapshot';
import {
  removeSlashQuery,
  slashKey,
  slashPlugin,
  type SlashBridge,
} from '@/lib/article/article-slash';
import { filterSlashItems, type SlashItem } from '@/lib/article/article-slash-items';
import { setBlockStyle, toggleList } from '@/lib/article/article-commands';
import { caretOf } from '@/lib/article/article-caret';
import { setLocalArticleCaret, useArticlePeers } from '@/lib/article/article-carets-store';
import { articlePeersPlugin, onlyPeers, setArticlePeers } from '@/lib/article/article-peers';
import { SLASH_MENU_ID, SlashMenu, slashOptionId } from './SlashMenu';
import { useArticleLinkHover } from './useArticleLinkHover';
import { articlePasteIsCanvas } from '@/lib/clipboard-payload';
import type { ArticleInsert } from '@/hooks/editor/useArticles';
import { debugLog } from '@/lib/debug-log';

// How long typing pauses before it is written to the tab (docs/specs/007-editor/article-pages.md
// "Writing", "Commits").
const ARTICLE_IDLE_COMMIT_MS = 600;
// How long after a local change this person still counts as the writer of its consequences.
const WRITER_WINDOW_MS = 3000;
// How long an undo or redo from the writing waits for its writing to come back (UNDO_SETTLE_MS).
const UNDO_SETTLE_MS = 400;

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
  // The tab holds as many pages as it can (MAX_ILLUSTRATE_PAGES): no page is added for writing that
  // runs past the last.
  atPageLimit?: boolean;
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
  // False when the host refuses the writing (the tab locked, no rights).
  onCommit: (flow: string, blocks: ArticleBlock[]) => boolean;
  onLayout: (layout: FlowLayout) => void;
  onUndo: () => void;
  onRedo: () => void;
  onLinkRequest: () => void;
  // A click on a margin note's text: its thread, or its action, opens beside it.
  onNoteOpen?: (id: string, kind: 'comment' | 'action') => void;
  // An object put in at the caret (the slash menu): a table, a chart, a drawing...
  onInsert: (flow: string, what: ArticleInsert) => void;
  // A press on the writing: the canvas's selection goes.
  onWritingPress: () => void;
  focusRequest: FocusRequest;
  // The request was taken (it is spent).
  onFocusTaken?: (seq: number) => void;
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
  // An undo or redo from the writing in hand: the writing it brings back takes the caret. Set as
  // it is asked for and cleared once it settles, so an undo that touches no writing (a shape's,
  // or nothing to undo) never leaves a later collaborator's edit taking the caret.
  const undoing = useRef(false);
  const undoReset = useRef<number | null>(null);
  const markUndoing = () => {
    undoing.current = true;
    if (undoReset.current !== null) window.clearTimeout(undoReset.current);
    undoReset.current = window.setTimeout(() => {
      undoReset.current = null;
      undoing.current = false;
    }, UNDO_SETTLE_MS);
  };
  const blurTimer = useRef<number | null>(null);
  // The writing runs past the last page while the tab is at its page limit.
  const [cutOff, setCutOff] = useState(false);
  // The writing as soft bars, measured once per layout (handle.bars).
  const barsCache = useRef<{ ink: string; ops: ArticleDrawOp[] } | null>(null);
  // The slash menu: open with its query and where the `/` is, and the entry highlighted.
  const [slash, setSlash] = useState<{
    query: string;
    at: { left: number; top: number; bottom: number };
  } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const slashItems = slash ? filterSlashItems(slash.query) : [];
  const slashLive = useRef({ items: slashItems, index: slashIndex, open: false });
  useLayoutEffect(() => {
    const open = !!slash && slashItems.length > 0;
    const was = slashLive.current;
    slashLive.current = { items: slashItems, index: slashIndex, open };
    // The writing points at the open menu and its highlighted option (aria-activedescendant).
    if (was.open !== open || was.index !== slashIndex) viewRef.current?.setProps({});
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
    // Taken as written only once the host accepts it (a tab locked meanwhile refuses): refused,
    // it stays local and goes with the next commit.
    if (latest.current.onCommit(latest.current.flow, blocks) === false) return;
    committed.current = { ...committed.current, blocks };
  };
  const scheduleCommit = () => {
    if (idle.current !== null) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(flush, ARTICLE_IDLE_COMMIT_MS);
  };

  const measure = () => {
    // A new layout: the bars measured from the last one are out of date.
    barsCache.current = null;
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
    // At the tab's page limit the writing past the last page waits unseen: say so on that page.
    const cut = p.atPageLimit === true && pagesNeeded > p.pages.length;
    setCutOff((was) => (was === cut ? was : cut));
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
  // The caret's page, read in a frame after a change (reading it inside a transaction would force
  // a layout of the whole article per keystroke), and what was last published, so the toolbar
  // and its hosts re-render only when something they show changed.
  const caretPageId = useRef<string | null>(null);
  const caretFrame = useRef<number | null>(null);
  const published = useRef<{ pageId: string | null; selection: ArticleSelectionState } | null>(
    null,
  );
  const publish = (view: EditorView) => {
    if (!view.hasFocus() || !handleRef.current) return;
    // Where we are writing, for collaborators (docs/specs/007-editor/article-pages.md
    // "Collaboration"); a viewer's writing takes no caret.
    if (latest.current.editable) setLocalArticleCaret(latest.current.flow, caretOf(view.state));
    const selection = selectionStateOf(view.state);
    const pageId = caretPageId.current ?? latest.current.pages[0]?.id ?? null;
    const was = published.current;
    if (
      !was ||
      was.pageId !== pageId ||
      !sameSelectionState(was.selection, selection) ||
      getActiveArticle()?.handle !== handleRef.current ||
      !getActiveArticle()?.focused
    ) {
      published.current = { pageId, selection };
      setActiveArticle({ handle: handleRef.current, pageId, selection, focused: true });
    }
    if (caretFrame.current === null)
      caretFrame.current = requestAnimationFrame(() => {
        caretFrame.current = null;
        const v = viewRef.current;
        if (!v) return;
        const page = caretPage(v);
        if (page === caretPageId.current) return;
        caretPageId.current = page;
        publish(v);
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
            markUndoing();
            latest.current.onUndo();
          },
          redo: () => {
            flush();
            markUndoing();
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
        articlePeersPlugin,
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
          ...(slashLive.current.open
            ? {
                'aria-controls': SLASH_MENU_ID,
                'aria-expanded': 'true',
                'aria-activedescendant': slashOptionId(
                  Math.min(slashLive.current.index, slashLive.current.items.length - 1),
                ),
              }
            : {}),
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
        return true;
      },
      dispatchTransaction(tr: Transaction) {
        const v = viewRef.current;
        if (!v) return;
        v.updateState(v.state.apply(tr));
        // Collaborators' carets arriving change nothing of ours: no commit, no toolbar update.
        if (onlyPeers(tr)) return;
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
        // An image, or elements copied from a canvas: not the writing's to take. Left alone (no
        // preventDefault), the paste reaches the canvas, which puts it into the writing as a zone.
        paste: (_v, e) => articlePasteIsCanvas(e.clipboardData),
        click: (_v, e) => {
          // A plain click on a margin note's text opens what it carries; a drag that selects
          // does not.
          const note = (e.target as Element | null)?.closest?.('[data-note-id]');
          const sel = window.getSelection();
          if (!note || (sel && !sel.isCollapsed)) return false;
          const id = (note as HTMLElement).dataset.noteId;
          if (id)
            latest.current.onNoteOpen?.(
              id,
              note.classList.contains('article-note-action') ? 'action' : 'comment',
            );
          return false;
        },
        focus: (v) => {
          publish(v);
          return false;
        },
        blur: (v) => {
          flush();
          // A slash menu open as the writing loses the caret closes with it.
          if (slashKey.getState(v.state)?.active) v.dispatch(v.state.tr.setMeta(slashKey, 'close'));
          // The article stays active (its page keeps its toolbar) until a press lands off its
          // pages (PageToolbar); only the focus goes.
          if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
          blurTimer.current = window.setTimeout(() => {
            blurTimer.current = null;
            if (v.hasFocus()) return;
            blurActiveArticle(latest.current.flow);
            setLocalArticleCaret(latest.current.flow, null);
          }, 0);
          return false;
        },
      },
    });
    viewRef.current = view;
    // A handle for driving the writing in development (browser checks); never in production.
    if (process.env.NODE_ENV !== 'production') Reflect.set(window, '__articleView', view);
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
      takeBlocks: () => {
        const blocks = docToBlocks(view.state.doc, committed.current.blocks);
        committed.current = { ...committed.current, blocks };
        if (idle.current !== null) {
          window.clearTimeout(idle.current);
          idle.current = null;
        }
        return blocks;
      },
      undo: () => {
        flush();
        markUndoing();
        latest.current.onUndo();
        view.focus();
      },
      redo: () => {
        flush();
        markUndoing();
        latest.current.onRedo();
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
        // One walk of the writing per layout, whoever asks (the Map, every slide thumbnail).
        if (barsCache.current?.ink === ink) return barsCache.current.ops;
        const ops = (() => {
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
        })();
        barsCache.current = { ink, ops };
        return ops;
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
      if (caretFrame.current !== null) cancelAnimationFrame(caretFrame.current);
      caretFrame.current = null;
      flush();
      if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
      if (process.env.NODE_ENV !== 'production' && Reflect.get(window, '__articleView') === view)
        Reflect.deleteProperty(window, '__articleView');
      view.destroy();
      viewRef.current = null;
      clearActiveArticle(latest.current.flow);
      setLocalArticleCaret(latest.current.flow, null);
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

  // Collaborators' carets in this article: drawn by the peers plugin, brought in by a transaction
  // that changes no text.
  const peers = useArticlePeers(props.flow);
  useLayoutEffect(() => {
    const view = viewRef.current;
    if (view) view.dispatch(setArticlePeers(view.state, peers));
  }, [peers]);

  // A link hovered: its address, Open, Edit and Remove (made after the view, which it listens on).
  const linkCard = useArticleLinkHover(viewRef, props.editable);

  // A request to put the caret in this article (a new article: its title).
  const request = props.focusRequest;
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !request || request.flow !== props.flow || !props.editable) return;
    const sel =
      request.at === 'start' ? Selection.atStart(view.state.doc) : Selection.atEnd(view.state.doc);
    view.dispatch(view.state.tr.setSelection(sel));
    view.focus();
    props.onFocusTaken?.(request.seq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.seq]);

  return (
    <>
      {linkCard}
      {cutOff ? <PageLimitNotice page={props.pages[props.pages.length - 1]!} /> : null}
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

// The foot of an article's last page when the tab is at its page limit and the writing runs past it
// (docs/specs/007-editor/article-pages.md "Flowing onto pages", Limit). In canvas space, on the page.
function PageLimitNotice({ page }: { page: LaidOutPage }) {
  return (
    <div
      role="status"
      data-page-limit-notice=""
      className="pointer-events-none absolute flex items-end justify-center"
      style={{
        left: page.rect.x,
        top: page.rect.y + page.rect.height - 40,
        width: page.rect.width,
        height: 32,
      }}
    >
      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/30">
        This tab has reached {MAX_ILLUSTRATE_PAGES} pages: the writing below this line is hidden
      </span>
    </div>
  );
}
