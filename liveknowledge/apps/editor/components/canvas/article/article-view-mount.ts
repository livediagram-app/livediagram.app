import type { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from 'react';
import { EditorState, TextSelection, type Plugin, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { gapCursor } from 'prosemirror-gapcursor';
import { cleanFootnoteText, isContinuousPage, type ArticleFlow } from '@liveknowledge/document';
import { blocksToDoc } from '@/lib/article/article-convert';
import { articleKeymap, articleInputRules } from '@/lib/article/article-keys';
import { blockIdsPlugin, decorationsPlugin, todoTogglePlugin } from '@/lib/article/article-plugins';
import { announceArticleCap, articleCapsPlugin } from '@/lib/article/article-caps';
import { findHighlightPlugin } from '@/lib/article/article-find-plugin';
import { suggestionMarksPlugin } from '@/lib/article/article-suggestion-plugin';
import {
  clearActiveArticle,
  registerArticleHandle,
  requestArticleComment,
  blurActiveArticle,
  type ArticleEditorHandle,
} from '@/lib/article/article-editor-store';
import { flowFrame } from '@/lib/article/article-flow-geometry';
import { articleStyleVars } from '@/lib/article/article-style-vars';
import type { ArticleDrawOp } from '@/lib/article/article-snapshot';
import { slashKey, slashPlugin, type SlashBridge } from '@/lib/article/article-slash';
import { slashItemById, type SlashItem } from '@/lib/article/article-slash-items';
import { groupJump } from '@/lib/article/slash-menu-model';
import { readSlashPicks, recentIds } from '@/lib/article/slash-recent';
import { articleLookOf } from '@/lib/article/article-style-vars';
import { setLocalArticleCaret } from '@/lib/article/article-carets-store';
import { articlePeersPlugin, onlyPeers } from '@/lib/article/article-peers';
import { articleHoldsPlugin, holdSpotOf, onlyHolds } from '@/lib/article/article-holds';
import { noteArticleTyping, releaseArticleHold } from '@/lib/article/article-holds-store';
import { announceArticleHeld } from '@/lib/article/article-hold-notice';
import { followLivePageTitle, noteLivePageTitle, titleTextOf } from '@/lib/article/live-page-title';
import { SLASH_MENU_ID, slashOptionId } from './SlashMenu';
import { createArticleHandle, writingScale } from './article-editor-handle';
import { articlePasteIsCanvas } from '@/lib/clipboard-payload';
import { articlePasteProps } from '@/lib/article/article-paste';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { track } from '@/lib/telemetry';
import {
  articleTablePasteProps,
  jumpToHeading,
  tableKeyPlugins,
  tableNodeViews,
  tablePlugins,
  type TableRights,
} from '@/lib/article/article-table-editor';
import {
  footnoteKey,
  footnoteNodeView,
  footnotesPlugin,
  insertFootnote,
  removeFootnoteTr,
} from '@/lib/article/article-footnotes';
import { FootnoteNotes } from '@/lib/article/article-footnote-notes';
import { commitWritingOnLeave } from '@/lib/article/article-open-edit';
import type { ArticleEditorProps, SlashState } from './article-editor-types';
import { articleFlowClass } from './read-mode-selection';

// The writing's paste, tables composed over it.
const pasteProps = articleTablePasteProps(articlePasteProps);

// What the writing's view is made from (ArticleEditor's refs, setters and handlers, as of its first render).
export type MountContext = {
  host: MutableRefObject<HTMLDivElement | null>;
  viewRef: MutableRefObject<EditorView | null>;
  latest: MutableRefObject<ArticleEditorProps>;
  committed: MutableRefObject<ArticleFlow>;
  idle: MutableRefObject<number | null>;
  lastLocal: MutableRefObject<number>;
  measureFrame: MutableRefObject<number | null>;
  notesRef: MutableRefObject<FootnoteNotes | null>;
  announced: MutableRefObject<boolean>;
  blurTimer: MutableRefObject<number | null>;
  barsCache: MutableRefObject<{ ink: string; ops: ArticleDrawOp[] } | null>;
  slashLive: MutableRefObject<{
    items: readonly SlashItem[];
    starts: readonly number[];
    index: number;
    open: boolean;
  }>;
  pickSlashRef: MutableRefObject<(item: SlashItem) => void>;
  handleRef: MutableRefObject<ArticleEditorHandle | null>;
  caretFrame: MutableRefObject<number | null>;
  revealFrame: MutableRefObject<number | null>;
  setSlash: Dispatch<SetStateAction<SlashState | null>>;
  setSlashIndex: Dispatch<SetStateAction<number>>;
  flush: () => boolean;
  undoRedo: (which: 'undo' | 'redo') => void;
  scheduleCommit: () => void;
  scheduleMeasure: () => void;
  scheduleReveal: () => void;
  publish: (view: EditorView) => void;
  // Plugins the host adds: before the writing's own, so their keys come first (the page picker's Enter and
  // arrows), and after them (a knowledgebase page's slots).
  leadingPlugins?: readonly Plugin[];
  extraPlugins?: readonly Plugin[];
};

// The writing's ProseMirror view, made once per article (ArticleEditor's mount effect): its plugins, its
// attributes and node views, how a transaction is applied, its DOM events, the notes at the pages' feet and
// its handle; returns the cleanup that takes it all down again.
export function mountArticleView({
  host,
  viewRef,
  latest,
  committed,
  idle,
  lastLocal,
  measureFrame,
  notesRef,
  announced,
  blurTimer,
  barsCache,
  slashLive,
  pickSlashRef,
  handleRef,
  caretFrame,
  revealFrame,
  setSlash,
  setSlashIndex,
  flush,
  undoRedo,
  scheduleCommit,
  scheduleMeasure,
  scheduleReveal,
  publish,
  leadingPlugins = [],
  extraPlugins = [],
}: MountContext): (() => void) | undefined {
  const mount = host.current;
  if (!mount) return;
  const isEditable = () => latest.current.editable;
  const rights: TableRights = {
    editable: isEditable,
    reshape: () => latest.current.reshape !== false,
    commit: () => {
      flush();
    },
  };
  const bridge: SlashBridge = {
    onChange: (s, v) => {
      if (!s.active) {
        setSlash(null);
        return;
      }
      try {
        const c = v.coordsAtPos(s.from);
        const at = { left: c.left, top: c.top, bottom: c.bottom };
        setSlash((prev) => {
          if (prev?.query !== s.query) setSlashIndex(0);
          // Recent and the writing's look are read once, as it opens; each letter typed only filters.
          if (prev) return { ...prev, query: s.query, at };
          const recent = recentIds(readSlashPicks(), Date.now(), (id) => !!slashItemById(id));
          return { query: s.query, at, recent, look: articleLookOf(v.dom) };
        });
      } catch {
        setSlash(null);
      }
    },
    onKey: (key) => {
      const { items, starts, index } = slashLive.current;
      if (items.length === 0) return false;
      if (key === 'down') setSlashIndex((index + 1) % items.length);
      else if (key === 'up') setSlashIndex((index - 1 + items.length) % items.length);
      else if (key === 'next-group') setSlashIndex(groupJump(starts, index, 1));
      else if (key === 'prev-group') setSlashIndex(groupJump(starts, index, -1));
      else pickSlashRef.current(items[index] ?? items[0]!);
      return true;
    },
  };
  const state = EditorState.create({
    doc: blocksToDoc(committed.current.blocks),
    plugins: [
      ...leadingPlugins,
      // First, so its keys come before Enter's and the arrows'.
      slashPlugin(bridge),
      // A cell's keys before the writing's (Tab, Enter and Backspace mean other things there).
      ...tableKeyPlugins(rights),
      ...articleKeymap({
        undo: () => undoRedo('undo'),
        redo: () => undoRedo('redo'),
        onLink: () => latest.current.onLinkRequest(),
        onComment: () => requestArticleComment(),
        // Not by a Participant (an insert).
        onFootnote: (state, dispatch, v) => {
          const p = latest.current;
          if (p.reshape === false || !p.editable) return false;
          const done = insertFootnote(state, dispatch, v);
          if (done && dispatch) track('Element', 'Added', 'ArticleFootnote');
          return done;
        },
        onEscape: () => {
          flush();
          viewRef.current?.dom?.blur();
        },
      }),
      articleInputRules(),
      // Never past the article's caps: a paste or a key that would go past them is refused, said once.
      articleCapsPlugin((cap) => announceArticleCap(cap)),
      blockIdsPlugin,
      decorationsPlugin(isEditable),
      todoTogglePlugin(isEditable),
      articlePeersPlugin,
      // Collaborators' holds: outlined, and our typing in them refused with a notice naming the writer
      // (docs/specs/007-editor/article-pages.md "Holding a paragraph").
      articleHoldsPlugin((hold) => announceArticleHeld(hold.name)),
      // The Find bar's matches in this writing (docs/specs/007-editor/find-and-replace.md "Highlights").
      findHighlightPlugin(() => latest.current.flow),
      // Agents' suggested edits on the page (docs/specs/030-knowledgebase/ai-knowledge.md "On the page").
      suggestionMarksPlugin(() => latest.current.flow),
      // The footnotes' numbers and the breaks above their notes; a press on a reference puts the caret in its note.
      footnotesPlugin((n) => {
        if (latest.current.editable) notesRef.current?.focus(n);
      }),
      ...tablePlugins(),
      gapCursor(),
      ...extraPlugins,
    ],
  });
  const view = new EditorView(mount, {
    state,
    editable: isEditable,
    // A caret the browser scrolls into view stops clear of the formatting bar pinned over the page's top
    // (docs/specs/030-knowledgebase/page-surface.md "The formatting bar"), and of the window's foot.
    scrollMargin: { top: 24, bottom: 32, left: 0, right: 0 },
    scrollThreshold: { top: 64, bottom: 24, left: 0, right: 0 },
    attributes: () => {
      const p = latest.current;
      const frame = flowFrame(p.pages, p.margin, p.topMin);
      const { vars, rules } = articleStyleVars(
        p.styleOverride ?? p.doc.style,
        p.themeAccent,
        p.ink,
      );
      // A continuous page's writing is one box as tall as itself, never columns of a page's height: the page follows
      // the writing (article-measure.ts), so nothing breaks to a next page.
      const continuous = isContinuousPage(p.pages[0]!);
      const style = {
        ...vars,
        left: `${frame.x}px`,
        top: `${frame.y}px`,
        width: `${frame.width}px`,
        [continuous ? 'minHeight' : 'height']: `${frame.height}px`,
        // The page's side margin, for what the writing hangs in it (a held paragraph's name chip).
        '--article-margin': `${frame.margin}px`,
      } as CSSProperties;
      const css = Object.entries(style)
        .map(
          ([k, v]) =>
            `${k.startsWith('--') ? k : k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v}`,
        )
        .join('; ');
      return {
        // Read, a reader selects and copies the writing (read-mode-selection.ts).
        class: articleFlowClass(p.editable),
        style: continuous
          ? css
          : `${css}; column-count: ${frame.count}; column-gap: ${frame.gap}px`,
        ...(continuous ? { 'data-continuous': '' } : {}),
        'data-rules': rules,
        'data-article-flow': p.flow,
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': 'Article text',
        spellcheck: 'true',
        // The open slash menu: the writing points at it and its highlighted option. A textbox
        // takes no aria-expanded (ARIA 1.2), so the popup is announced by aria-haspopup and the
        // active option alone.
        ...(slashLive.current.open
          ? {
              'aria-controls': SLASH_MENU_ID,
              'aria-haspopup': 'listbox',
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
    ...pasteProps,
    nodeViews: {
      footnote: footnoteNodeView,
      ...tableNodeViews(rights, (v, id) =>
        jumpToHeading(v, id, latest.current.editable, (r) => {
          const p = latest.current;
          const { frame, root, z } = writingScale(v, p);
          p.onRevealCaret?.({
            x: frame.x + (r.left - root.left) / z,
            y: frame.y + (r.top - root.top) / z,
            w: Math.max(1, r.width / z),
            h: Math.max(1, r.height / z),
          });
        }),
      ),
    },
    dispatchTransaction(tr: Transaction) {
      const v = viewRef.current;
      if (!v) return;
      v.updateState(v.state.apply(tr));
      // Collaborators' carets and holds arriving change nothing of ours: no commit, no toolbar update.
      if (onlyPeers(tr) || onlyHolds(tr)) return;
      if (tr.docChanged) {
        // The page tree names the page from its Title as it is typed (knowledgebases-and-pages.md "Name"): an
        // Editor's own Title edit sets it; any other change keeps a live title current.
        const title = titleTextOf(v.state.doc);
        const own = !tr.getMeta('article-remote') && latest.current.editable;
        if (own && latest.current.reshape !== false && title !== titleTextOf(tr.before))
          noteLivePageTitle(title ?? '');
        else followLivePageTitle(title);
        if (!tr.getMeta('article-remote')) {
          lastLocal.current = Date.now();
          // Typing holds the block (or cell) it is in (docs/specs/007-editor/article-pages.md "Holding a
          // paragraph"); a viewer types nothing.
          if (latest.current.editable) noteArticleTyping(latest.current.flow, holdSpotOf(v.state));
          scheduleCommit();
        }
        scheduleMeasure();
      }
      if ((tr.docChanged || tr.selectionSet) && !tr.getMeta('article-remote')) scheduleReveal();
      publish(v);
    },
    handleDOMEvents: {
      // An image, or elements copied from a canvas: not the writing's to take. Left alone (no
      // preventDefault), the paste reaches the canvas, which puts it into the writing as a zone.
      paste: (_v, e) => {
        return articlePasteIsCanvas(e.clipboardData);
      },
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
          releaseArticleHold(latest.current.flow);
        }, 0);
        return false;
      },
    },
  });
  viewRef.current = view;
  // The notes at the pages' feet: edited by anyone who may write, each change one edit of the writing.
  const commitNote = (n: number, text: string) => {
    const v = viewRef.current;
    if (!v || !latest.current.editable) return;
    const pos = footnoteKey.getState(v.state)?.refs[n - 1];
    const node = pos === undefined ? null : v.state.doc.nodeAt(pos);
    if (pos === undefined || !node || node.attrs.text === text) return;
    v.dispatch(v.state.tr.setNodeAttribute(pos, 'text', text));
    flush();
  };
  notesRef.current = new FootnoteNotes(mount, {
    editable: () => latest.current.editable,
    commit: commitNote,
    leave: (n) => {
      const v = viewRef.current;
      const pos = v ? footnoteKey.getState(v.state)?.refs[n - 1] : undefined;
      if (!v || pos === undefined) return;
      v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, pos + 1)));
      v.focus();
    },
    resize: () => scheduleMeasure(),
    press: () => latest.current.onWritingPress(),
    // Removed from its note: the reference goes (one edit), the caret where it stood.
    remove: (n) => {
      const v = viewRef.current;
      if (!v || !latest.current.editable) return;
      const tr = removeFootnoteTr(v.state, n);
      if (!tr) return;
      v.focus();
      v.dispatch(tr);
      flush();
    },
  });
  // A handle for driving the writing in development (browser checks); never in production.
  if (process.env.NODE_ENV !== 'production') Reflect.set(window, '__articleView', view);
  handleRef.current = createArticleHandle({
    view,
    latest,
    committed,
    idle,
    lastLocal,
    barsCache,
    flush,
    undoRedo,
    noteRoots: () => notesRef.current?.roots() ?? [],
  });
  const unregister = registerArticleHandle(handleRef.current);
  // A reload or a closed tab takes what was typed with it: the note being written, then the writing.
  const stopLeave = commitWritingOnLeave(mount, () => {
    const note = notesRef.current?.editing();
    if (note) commitNote(note.n, cleanFootnoteText(note.text));
    flush();
  });
  scheduleMeasure();
  // Web fonts arriving change every line's length.
  const fonts = document.fonts;
  const onFonts = () => {
    announced.current = false;
    scheduleMeasure();
  };
  fonts?.addEventListener?.('loadingdone', onFonts);
  debugLog('[article] writing mounted', { flow: latest.current.flow });
  return () => {
    fonts?.removeEventListener?.('loadingdone', onFonts);
    unregister();
    stopLeave();
    if (measureFrame.current !== null) cancelAnimationFrame(measureFrame.current);
    measureFrame.current = null;
    if (caretFrame.current !== null) cancelAnimationFrame(caretFrame.current);
    caretFrame.current = null;
    if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current);
    revealFrame.current = null;
    flush();
    if (blurTimer.current !== null) window.clearTimeout(blurTimer.current);
    if (process.env.NODE_ENV !== 'production' && Reflect.get(window, '__articleView') === view)
      Reflect.deleteProperty(window, '__articleView');
    notesRef.current?.destroy();
    notesRef.current = null;
    view.destroy();
    viewRef.current = null;
    clearActiveArticle(latest.current.flow);
    setLocalArticleCaret(latest.current.flow, null);
    releaseArticleHold(latest.current.flow);
  };
}
