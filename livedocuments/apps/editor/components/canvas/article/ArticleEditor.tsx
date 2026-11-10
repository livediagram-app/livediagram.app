'use client';

// One article's writing (docs/specs/007-editor/article-pages.md): a ProseMirror editor laid over
// the article's pages in canvas space, its text in columns, one a page, so the browser breaks
// lines between pages and wraps text round floated zones. It owns the text while someone types:
// what they type is written to the tab when they pause (ARTICLE_IDLE_COMMIT_MS), leave the writing, or
// do anything that is not typing; what changes on the tab from elsewhere (a collaborator's blocks,
// an undo) is merged in block by block, so neither loses the other. After every change it measures
// where the writing reaches (how many pages, where each zone landed) and reports it, so the host
// can add or remove pages and move zones' elements (useArticles).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Selection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { applyArticleOps, diffArticleFlow, type ArticleFlow } from '@livedocuments/document';
import { docToBlocks } from '@/lib/article/article-convert';
import {
  insertBlocksAfterCaret,
  sameSelectionState,
  selectionStateOf,
  type ArticleSelectionState,
} from '@/lib/article/article-commands';
import {
  setActiveArticle,
  getActiveArticle,
  type ArticleEditorHandle,
} from '@/lib/article/article-editor-store';
import { articleSchema } from '@/lib/article/article-schema';
import { columnAt } from '@/lib/article/article-flow-geometry';
import { FlashcardTooLong } from './FlashcardTooLong';
import type { ArticleDrawOp } from '@/lib/article/article-snapshot';
import { removeSlashQuery } from '@/lib/article/article-slash';
import { filterSlashItems, type SlashItem } from '@/lib/article/article-slash-items';
import { setBlockStyle, toggleList } from '@/lib/article/article-commands';
import { caretOf } from '@/lib/article/article-caret';
import { setLocalArticleCaret, useArticlePeers } from '@/lib/article/article-carets-store';
import { setArticlePeers } from '@/lib/article/article-peers';
import { SlashMenu } from './SlashMenu';
import { useArticleLinkHover } from './useArticleLinkHover';
import { caretCanvasRect, writingScale } from './article-editor-handle';
import { track } from '@/lib/telemetry';
import { slashInsertEvent } from '@/lib/article/article-telemetry';
import { insertTable } from '@/lib/article/article-table-commands';
import { insertFootnote } from '@/lib/article/article-footnotes';
import { FootnoteNotes } from '@/lib/article/article-footnote-notes';
import type { ArticleEditorProps } from './article-editor-types';
import { measureArticleLayout } from './article-measure';
import { mountArticleView } from './article-view-mount';
import { PageLimitNotice, replaceContent } from './article-editor-parts';

// How long typing pauses before it is written to the tab (docs/specs/007-editor/article-pages.md
// "Writing", "Commits").
const ARTICLE_IDLE_COMMIT_MS = 600;
// How long an undo or redo from the writing waits for its writing to come back (UNDO_SETTLE_MS).
const UNDO_SETTLE_MS = 400;

export type { FlowLayout, FocusRequest, ArticleEditorProps } from './article-editor-types';

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
  const repeatTries = useRef(0);
  // The notes at the pages' feet, and each page's text foot above them (the header rows repeat above it).
  const notesRef = useRef<FootnoteNotes | null>(null);
  const footLimits = useRef<ReadonlyMap<number, number>>(new Map());
  const footTries = useRef(0);
  // Whether this writing's layout has been announced to the pictures drawn from it (the Map).
  const announced = useRef(false);
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
  // An undo or redo asked for from the writing: what was typed goes first, as its own step, then
  // the undo of it, the tab's article back to the very object it was: `undoSeq` has the writing look
  // at the tab again all the same.
  const [undoSeq, setUndoSeq] = useState(0);
  const undoRedo = (which: 'undo' | 'redo') => {
    const run = () => {
      markUndoing();
      if (which === 'undo') latest.current.onUndo();
      else latest.current.onRedo();
      setUndoSeq((n) => n + 1);
    };
    // The host decides whether there is anything to undo from its last render, so an undo that
    // follows a commit made just now waits for that render: else ⌘Z within a pause of a session's
    // first typing found nothing to undo and the typing stayed.
    if (flush()) window.setTimeout(run, 0);
    else run();
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
  const slashItems =
    slash && props.reshape !== false ? filterSlashItems(slash.query, props.card === true) : [];
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
    let done = false;
    if (a.kind === 'style') done = setBlockStyle(a.style)(view.state, view.dispatch, view);
    else if (a.kind === 'list') done = toggleList(a.list)(view.state, view.dispatch, view);
    else if (a.kind === 'block' && a.block === 'table')
      done = insertTable(view.state, view.dispatch, view);
    else if (a.kind === 'block' && a.block === 'footnote')
      done = insertFootnote(view.state, view.dispatch, view);
    else if (a.kind === 'block')
      done = insertBlocksAfterCaret(
        a.block === 'divider'
          ? [articleSchema.nodes.divider.create()]
          : a.block === 'toc'
            ? [articleSchema.nodes.toc.create(), articleSchema.nodes.paragraph.create()]
            : [articleSchema.nodes.page_break.create(), articleSchema.nodes.paragraph.create()],
      )(view.state, view.dispatch, view);
    else latest.current.onInsert(latest.current.flow, a.what);
    // A block put in from the menu counts as the toolbar's Insert does, once it went in; an
    // object insert is counted by its host (useArticles) once it lands.
    const event = done ? slashInsertEvent(a) : null;
    if (event) track('Element', 'Added', event);
    view.focus();
  };
  const pickSlashRef = useRef(pickSlash);
  useLayoutEffect(() => {
    pickSlashRef.current = pickSlash;
  });

  // Everything below reads the view through the ref; created once, below.
  // Writes what was typed since the last commit; true when it wrote something.
  const flush = (): boolean => {
    const view = viewRef.current;
    if (idle.current !== null) {
      window.clearTimeout(idle.current);
      idle.current = null;
    }
    if (!view) return false;
    const blocks = docToBlocks(view.state.doc, committed.current.blocks);
    if (blocks === committed.current.blocks) return false;
    // Taken as written only once the host accepts it (a tab locked meanwhile refuses): refused,
    // it stays local and goes with the next commit.
    if (latest.current.onCommit(latest.current.flow, blocks) === false) return false;
    committed.current = { ...committed.current, blocks };
    return true;
  };
  const scheduleCommit = () => {
    if (idle.current !== null) window.clearTimeout(idle.current);
    idle.current = window.setTimeout(flush, ARTICLE_IDLE_COMMIT_MS);
  };

  const measure = () =>
    measureArticleLayout({
      barsCache,
      measureFrame,
      viewRef,
      latest,
      repeatTries,
      footLimits,
      notesRef,
      footTries,
      lastLocal,
      announced,
      scheduleMeasure,
      setCutOff,
    });
  const scheduleMeasure = () => {
    if (measureFrame.current !== null) return;
    measureFrame.current = requestAnimationFrame(measure);
  };

  // The page the caret is on, by the column its screen spot falls in.
  const caretPage = (view: EditorView): string | null => {
    const p = latest.current;
    try {
      const at = view.coordsAtPos(view.state.selection.head);
      const { frame, root, z } = writingScale(view, p);
      const col = columnAt(frame, (at.left - root.left) / z);
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
  // The caret kept in sight as it is written on, read in a frame after the change (as the caret's page is): the
  // writing runs onto pages the view does not show, and the caret went with it out of sight.
  const revealFrame = useRef<number | null>(null);
  const scheduleReveal = () => {
    if (revealFrame.current !== null) return;
    revealFrame.current = requestAnimationFrame(() => {
      revealFrame.current = null;
      const v = viewRef.current;
      const p = latest.current;
      if (!v || !p.editable || !v.hasFocus() || !p.onRevealCaret) return;
      const rect = caretCanvasRect(v, p);
      // A card never flows: a caret past its foot is in writing kept but hidden (the Too long
      // marker says so), and the view stays on the card rather than following it off.
      const card = p.card ? p.pages[0] : undefined;
      if (card && rect && rect.x >= card.rect.x + card.rect.width) return;
      if (rect) p.onRevealCaret(rect);
    });
  };
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
    return mountArticleView({
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
    });
    // oxlint-disable-next-line react/exhaustive-deps -- created once per article: everything it reads is read through refs
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
  }, [props.doc, undoSeq]);

  // Pages, zoom, style or rights changed: the box, its columns and its look follow.
  useLayoutEffect(() => {
    viewRef.current?.setProps({});
    scheduleMeasure();
  }, [
    props.pages,
    props.zoom,
    props.ink,
    props.themeAccent,
    props.margin,
    props.topMin,
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
    // oxlint-disable-next-line react/exhaustive-deps -- runs once per request, keyed on its seq
  }, [request?.seq]);

  return (
    <>
      {linkCard}
      {cutOff && props.card ? (
        <FlashcardTooLong page={props.pages[0]!} zoom={props.zoom} split={props.split} />
      ) : cutOff ? (
        <PageLimitNotice page={props.pages[props.pages.length - 1]!} />
      ) : null}
      {slash && props.editable && props.reshape !== false ? (
        <SlashMenu
          at={slash.at}
          items={slashItems}
          query={slash.query}
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
          const { onWritingPress, onTouchPress } = latest.current;
          if (!onTouchPress?.(e, onWritingPress)) onWritingPress();
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
      />
    </>
  );
}
