import type { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from 'react';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { gapCursor } from 'prosemirror-gapcursor';
import { cleanFootnoteText, type ArticleFlow } from '@livedocuments/document';
import { blocksToDoc } from '@/lib/article/article-convert';
import { articleKeymap, articleInputRules } from '@/lib/article/article-keys';
import { blockIdsPlugin, decorationsPlugin, todoTogglePlugin } from '@/lib/article/article-plugins';
import { announceArticleCap, articleCapsPlugin } from '@/lib/article/article-caps';
import { findHighlightPlugin } from '@/lib/article/article-find-plugin';
import {
  clearActiveArticle,
  registerArticleHandle,
  requestArticleComment,
  blurActiveArticle,
  type ArticleEditorHandle,
} from '@/lib/article/article-editor-store';
import { flowFrame } from '@/lib/article/article-flow-geometry';
import { publishCardOverflow } from '@/lib/flashcard-overflow-store';
import { announceTextOnly } from '@/lib/flashcard-guard';
import { articleStyleVars } from '@/lib/article/article-style-vars';
import type { ArticleDrawOp } from '@/lib/article/article-snapshot';
import { slashKey, slashPlugin, type SlashBridge } from '@/lib/article/article-slash';
import { type SlashItem } from '@/lib/article/article-slash-items';
import { setLocalArticleCaret } from '@/lib/article/article-carets-store';
import { articlePeersPlugin, onlyPeers } from '@/lib/article/article-peers';
import { SLASH_MENU_ID, slashOptionId } from './SlashMenu';
import { createArticleHandle, writingScale } from './article-editor-handle';
import { articlePasteIsCanvas } from '@/lib/clipboard-payload';
import { articlePasteProps } from '@/lib/article/article-paste';
import { cardPasteSlice } from '@/lib/article/article-card-paste';
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
} from '@/lib/article/article-footnotes';
import { FootnoteNotes } from '@/lib/article/article-footnote-notes';
import { commitWritingOnLeave } from '@/lib/article/article-open-edit';
import type { ArticleEditorProps, SlashState } from './article-editor-types';

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
  slashLive: MutableRefObject<{ items: SlashItem[]; index: number; open: boolean }>;
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
      // A cell's keys before the writing's (Tab, Enter and Backspace mean other things there).
      ...tableKeyPlugins(rights),
      ...articleKeymap({
        undo: () => undoRedo('undo'),
        redo: () => undoRedo('redo'),
        onLink: () => latest.current.onLinkRequest(),
        onComment: () => requestArticleComment(),
        // Not on a card, and not by a Participant (an insert).
        onFootnote: (state, dispatch, v) => {
          const p = latest.current;
          if (p.card || p.reshape === false || !p.editable) return false;
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
      // The Find bar's matches in this writing (docs/specs/007-editor/find-and-replace.md "Highlights").
      findHighlightPlugin(() => latest.current.flow),
      // The footnotes' numbers and the breaks above their notes; a press on a reference puts the caret in its note.
      footnotesPlugin((n) => {
        if (latest.current.editable) notesRef.current?.focus(n);
      }),
      ...tablePlugins(),
      gapCursor(),
    ],
  });
  const view = new EditorView(mount, {
    state,
    editable: isEditable,
    attributes: () => {
      const p = latest.current;
      const frame = flowFrame(p.pages, p.margin, p.topMin);
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
    // A card holds text only: a pasted table comes as a list, a page break or a zone not at all
    // (docs/specs/007-editor/flashcards.md "Text only").
    transformPasted: (slice) => {
      if (!latest.current.card) return slice;
      const onCard = cardPasteSlice(slice);
      if (onCard.cut) announceTextOnly();
      return onCard.slice;
    },
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
      // Collaborators' carets arriving change nothing of ours: no commit, no toolbar update.
      if (onlyPeers(tr)) return;
      if (tr.docChanged) {
        if (!tr.getMeta('article-remote')) {
          lastLocal.current = Date.now();
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
        if (!articlePasteIsCanvas(e.clipboardData)) return false;
        // A card holds text only: a picture or canvas elements pasted on it are dropped
        // (docs/specs/007-editor/flashcards.md "Text only").
        if (latest.current.card) {
          e.preventDefault();
          announceTextOnly();
        }
        return true;
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
    if (latest.current.card) publishCardOverflow(latest.current.flow, null);
    setLocalArticleCaret(latest.current.flow, null);
  };
}
