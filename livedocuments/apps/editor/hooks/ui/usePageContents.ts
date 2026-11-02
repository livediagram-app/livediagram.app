'use client';

// Pages mode's Contents as state (docs/specs/007-editor/pages-mode.md "Contents"), shared by
// its two homes: the popover (a bottom sheet on a phone) and the sidebar docked down the canvas's
// left. The rows, Find a Page, the thumbnails, the page marked as here, going to a page, the
// keyboard, reordering by drag and adding a page live here once; each home lays them out.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { MAX_PAGES, type PageKind } from '@livedocuments/document';
import { usePageThumbnails, type PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { PagesModeView } from '@/hooks/editor/usePagesMode';
import {
  contentsDropUnit,
  contentsRows,
  filterContents,
  type ContentsRow,
} from '@/lib/page-contents';
import { pageTexts } from '@/lib/page-texts';
import { track } from '@/lib/telemetry';
import { useRowReorderDrag } from '@liveworkspace/workbench/hooks/ui/useRowReorderDrag';
import {
  pageRowModel,
  type PageRowModel,
} from '@liveworkspace/workbench/components/canvas/PageRowMenu';
import { pageRowSlides } from '@/components/canvas/page-row-slides';
import { requestPagePanel } from '@/lib/page-panel-request';

// How far beyond the list's visible part a row's picture is drawn ahead of a scroll, in px.
const CONTENTS_DRAW_AHEAD_PX = 400;

export function usePageContents({
  view,
  tab,
  here,
  settleMs = 0,
  onWent,
}: {
  view: PagesModeView;
  tab: PageThumbTab;
  // The page in view as the list opens, scrolled to and marked.
  here: string | undefined;
  // How long the tab rests before the thumbnails redraw (usePageThumbnails); 0 redraws at once.
  settleMs?: number;
  // After a press went to a page (the phone's sheet closes then).
  onWent?: () => void;
}) {
  const { pages } = view;
  const [current, setCurrent] = useState(here);
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () =>
      contentsRows(pages, {
        ...(view.deck
          ? {
              inDeck: (id: string) => !!view.deck!.slideOf(id),
              hiddenInSlides: (id: string) => view.deck!.slideOf(id)?.hidden === true,
            }
          : {}),
        ...(view.articles ? { articles: view.articles.flows } : {}),
      }),
    [pages, view.deck, view.articles],
  );
  // The words on each page, read only while a search is typed.
  const searching = query.trim() !== '';
  const texts = useMemo(
    () => (searching ? pageTexts(pages, tab.elements, view.articles?.flows) : undefined),
    [searching, pages, tab.elements, view.articles?.flows],
  );
  const shown = useMemo(() => filterContents(rows, query, texts), [rows, query, texts]);
  const list = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLElement>());
  // The rows scrolled near view: only their pictures are drawn (a 100-page tab draws the handful on
  // screen, not all of them, as the list opens), each kept once drawn. null draws every row's (no
  // IntersectionObserver).
  const [seen, setSeen] = useState<ReadonlySet<string> | null>(() =>
    typeof IntersectionObserver === 'undefined' ? null : new Set(),
  );
  const observer = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) =>
        setSeen((prev) => {
          let next: Set<string> | null = null;
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.pageRow;
            if (!entry.isIntersecting || !id || prev?.has(id) !== false) continue;
            next ??= new Set(prev);
            next.add(id);
          }
          return next ?? prev;
        }),
      { root: list.current, rootMargin: `${CONTENTS_DRAW_AHEAD_PX}px 0px` },
    );
    for (const el of buttons.current.values()) io.observe(el);
    observer.current = io;
    return () => {
      io.disconnect();
      observer.current = null;
    };
  }, []);
  const registerRow = (id: string, el: HTMLElement | null) => {
    const was = buttons.current.get(id);
    if (was && was !== el) observer.current?.unobserve(was);
    if (el) {
      buttons.current.set(id, el);
      observer.current?.observe(el);
    } else buttons.current.delete(id);
  };
  const thumbs = usePageThumbnails(
    tab,
    pages.filter((p) => !seen || seen.has(p.id)).map((p) => p.id),
    settleMs,
  );
  // A page just added: once it is in the list, it is here, and in view.
  const [added, setAdded] = useState<number | null>(null);

  // Open on the page in view, scrolled to it.
  useLayoutEffect(() => {
    if (here) buttons.current.get(here)?.scrollIntoView({ block: 'center' });
    // On opening only: `here` is the page in view as the list opened, and never changes.
  }, [here]);
  // The page just added, once it is in the list, is here (set while rendering, as React derives
  // state from a change in its inputs).
  if (added !== null && pages.length > added) {
    setAdded(null);
    setCurrent(pages[pages.length - 1]!.id);
  }
  // The marked row kept in view as it moves (a page added, a row pressed, the view moved on).
  useEffect(() => {
    if (current) buttons.current.get(current)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  // Dragging a row reorders the pages (an Editor's, with the whole list shown): a caret shows where
  // it lands and the move commits on release, as the pages row's own drag does.
  const movePageTo = view.edit?.movePageTo;
  const reorderable = !!movePageTo && query === '';
  const reorder = useRowReorderDrag({
    slot: 'contents-slot',
    count: shown.length,
    disabled: !reorderable,
    onDrop: (id, drop) => {
      const to = contentsDropUnit(pages, id, drop);
      if (to === null || !movePageTo) return;
      track('UI', 'Used', 'PageContentsReorder');
      movePageTo(id, to);
      setCurrent(id);
    },
  });

  const go = (row: ContentsRow, clickedAt?: number) => {
    // The release of a drag is not a press of the row.
    if (reorder.consumeDragClick(clickedAt)) return;
    track('UI', 'Used', 'PageContentsJump');
    setCurrent(row.id);
    view.focusPage(row.id);
    onWent?.();
  };
  const onListKey = (e: KeyboardEvent) => {
    const order = shown.map((r) => r.id);
    const at = order.indexOf((document.activeElement as HTMLElement | null)?.dataset.pageRow ?? '');
    const to =
      e.key === 'ArrowDown'
        ? Math.min(order.length - 1, at + 1)
        : e.key === 'ArrowUp'
          ? Math.max(0, at - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? order.length - 1
              : null;
    if (to === null || order.length === 0) return;
    e.preventDefault();
    buttons.current.get(order[to]!)?.focus();
  };
  const full = pages.length >= MAX_PAGES;
  const add =
    view.edit?.addPage && !full
      ? (kind: PageKind) => {
          setAdded(pages.length);
          view.edit!.addPage!(kind);
        }
      : undefined;
  // Another page like the last (its kind and shape).
  const lastPage = pages.at(-1);
  const addLike =
    view.edit?.addPageLike && lastPage && !full
      ? () => {
          setAdded(pages.length);
          view.edit!.addPageLike!(lastPage.id);
        }
      : undefined;
  // A page's actions (an Editor's), for its row's tools and ⋯ menu: what each press does, absent
  // where it cannot. Delete refuses a locked page as the canvas does.
  const { edit, deck } = view;
  const actionsFor = (row: ContentsRow): PageRowModel | null => {
    if (!edit) return null;
    return pageRowModel({
      // The page framed, then its settings opened from its cog once it is there.
      settings: () => {
        view.focusPage(row.id);
        onWent?.();
        requestAnimationFrame(() => requestPagePanel(row.id));
      },
      extra: pageRowSlides(row, deck),
      ...(edit.duplicatePage && edit.canDuplicate(row.id) && !full
        ? { duplicate: () => edit.duplicatePage!(row.id) }
        : {}),
      ...(edit.canMove(row.id, -1) ? { moveUp: () => edit.movePage(row.id, -1) } : {}),
      ...(edit.canMove(row.id, 1) ? { moveDown: () => edit.movePage(row.id, 1) } : {}),
      locked: row.locked,
      toggleLock: () => edit.setLocked(row.id, !row.locked),
      ...(edit.removePage && !row.locked ? { remove: () => edit.removePage!(row.id) } : {}),
    });
  };
  const focusFirst = () => {
    if (shown[0]) buttons.current.get(shown[0].id)?.focus();
  };

  return {
    pages,
    shown,
    query,
    setQuery,
    thumbs,
    current,
    setCurrent,
    list,
    registerRow,
    reorder,
    reorderable,
    go,
    onListKey,
    focusFirst,
    // Absent for a Participant and a Viewer, who see no footer.
    canAdd: !!view.edit?.addPage,
    actionsFor,
    add,
    addLike,
    lastPage,
    full,
  };
}

export type PageContents = ReturnType<typeof usePageContents>;
