'use client';

// Pages mode's Contents as state (docs/specs/007-editor/pages-mode.md "Contents"), shared by
// its two homes: the popover (a bottom sheet on a phone) and the sidebar docked down the canvas's
// left. The rows drawn, the page marked as here, going to a page, the keyboard,
// reordering by drag, a page's actions and adding a page live here once; each home lays them out
// (components/canvas/PageContentsList). The editor hands in what is its own: the rows (what a page
// of its kinds says about itself), where a dropped page lands, the page an
// Add Page copies, and any extra verbs on a page's menu. Its thin usePageContents adds the pictures,
// drawn by its own renderer for the rows this hook says are near view (`drawnIds`).
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useRowReorderDrag, type RowDrop } from './useRowReorderDrag';
import {
  focusRowAfterRemove,
  pageRowModel,
  type PageRowAction,
  type PageRowModel,
} from '../../components/canvas/PageRowMenu';
import type { ContentsRowBase, ContentsThumb } from '../../lib/page-contents';

// How far beyond the list's visible part a row's picture is drawn ahead of a scroll, in px.
const CONTENTS_DRAW_AHEAD_PX = 400;

/** A page's edits, as Contents uses them (an Editor's; absent for a Participant and a Viewer).
 *  `A` is what Add Page takes: the page's kind, and in some editors more (a wireframe's device). */
export type ContentsPageEdits<A extends unknown[]> = {
  movePage: (pageId: string, by: -1 | 1) => void;
  movePageTo: (pageId: string, unitIndex: number) => void;
  canMove: (pageId: string, by: -1 | 1) => boolean;
  addPage?: (...args: A) => void;
  // Another page like `pageId`, right after `after` (the page Contents marks as here), else after `pageId`.
  addPageLike?: (pageId: string, after?: string) => void;
  duplicatePage?: (pageId: string) => void;
  canDuplicate: (pageId: string) => boolean;
  removePage?: (pageId: string) => void;
  setLocked: (pageId: string, locked: boolean) => void;
};

/** Pages mode's view, as far as Contents reads it. */
export type ContentsView<P extends { id: string }, A extends unknown[]> = {
  pages: readonly P[];
  // Frames one page in the view.
  focusPage: (pageId: string) => void;
  edit?: ContentsPageEdits<A> | undefined;
};

/** What a press in Contents sends to the editor's telemetry (`track('UI', 'Used', type)`). */
export type ContentsUse = 'PageContentsJump' | 'PageContentsReorder';

export function usePageContents<
  R extends ContentsRowBase,
  P extends { id: string },
  A extends unknown[],
>({
  view,
  rows,
  dropUnit,
  lastPage,
  maxPages,
  openSettings,
  extraActions,
  track,
  here,
  onWent,
}: {
  view: ContentsView<P, A>;
  // A row per page, in the row's order (the editor's contentsRows).
  rows: readonly R[];
  // The place among the row's units a page dropped beside the row lands at, or null where it stays.
  dropUnit: (pageId: string, drop: RowDrop) => number | null;
  // The page Add Page copies (its kind and shape); none hides the copy.
  lastPage: P | undefined;
  // The editor's page limit: at it, Add Page and Duplicate give way.
  maxPages: number;
  // Opens a page's settings, once the view has glided there (its cog's panel).
  openSettings: (pageId: string) => void;
  // A page's verbs of the editor's own, in the ⋯ menu after Page Settings (a slide's place in the deck).
  extraActions?: (row: R) => PageRowAction[];
  track: (type: ContentsUse) => void;
  // The page in view as the list opens, scrolled to and marked.
  here: string | undefined;
  // After a press went to a page (the phone's sheet closes then).
  onWent?: (() => void) | undefined;
}) {
  const { pages } = view;
  const [current, setCurrent] = useState(here);
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
  // The pages whose pictures are drawn: those scrolled near view.
  const drawnIds = pages.filter((p) => !seen || seen.has(p.id)).map((p) => p.id);
  // A page just added (the ids before it): once it is in the list, it is here, and in view. Found by id, since a new
  // page goes after the page here, not always last (pages-mode.md "Adding a page").
  const [added, setAdded] = useState<readonly string[] | null>(null);

  // Open on the page in view, scrolled to it.
  useLayoutEffect(() => {
    if (here) buttons.current.get(here)?.scrollIntoView({ block: 'center' });
    // On opening only: `here` is the page in view as the list opened, and never changes.
  }, [here]);
  // The page just added, once it is in the list, is here (set while rendering, as React derives
  // state from a change in its inputs).
  if (added !== null && pages.length > added.length) {
    setAdded(null);
    const before = new Set(added);
    setCurrent((pages.find((p) => !before.has(p.id)) ?? pages[pages.length - 1]!).id);
  }
  // The marked row kept in view as it moves (a page added, a row pressed, the view moved on).
  useEffect(() => {
    if (current) buttons.current.get(current)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  // Dragging a row reorders the pages (an Editor's): a caret shows where
  // it lands and the move commits on release, as the pages row's own drag does.
  const movePageTo = view.edit?.movePageTo;
  const reorderable = !!movePageTo;
  const reorder = useRowReorderDrag({
    slot: 'contents-slot',
    count: rows.length,
    disabled: !reorderable,
    onDrop: (id, drop) => {
      const to = dropUnit(id, drop);
      if (to === null || !movePageTo) return;
      track('PageContentsReorder');
      movePageTo(id, to);
      setCurrent(id);
    },
  });

  const go = (row: R, clickedAt?: number) => {
    // The release of a drag is not a press of the row.
    if (reorder.consumeDragClick(clickedAt)) return;
    track('PageContentsJump');
    setCurrent(row.id);
    view.focusPage(row.id);
    onWent?.();
  };
  const onListKey = (e: KeyboardEvent) => {
    const order = rows.map((r) => r.id);
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
  const full = pages.length >= maxPages;
  const { edit } = view;
  const addPage = edit?.addPage;
  const add =
    addPage && !full
      ? (...args: A) => {
          setAdded(pages.map((p) => p.id));
          addPage(...args);
        }
      : undefined;
  // Another page like the last (its kind and shape), right after the page here.
  const addPageLike = edit?.addPageLike;
  const addLike =
    addPageLike && lastPage && !full
      ? () => {
          setAdded(pages.map((p) => p.id));
          addPageLike(lastPage.id, current ?? undefined);
        }
      : undefined;
  // A page's actions (an Editor's), for its row's tools and ⋯ menu: what each press does, absent
  // where it cannot. Delete refuses a locked page as the canvas does.
  const actionsFor = (row: R): PageRowModel | null => {
    if (!edit) return null;
    return pageRowModel({
      // The page framed, then its settings opened from its cog once it is there.
      settings: () => {
        view.focusPage(row.id);
        onWent?.();
        requestAnimationFrame(() => openSettings(row.id));
      },
      ...(extraActions ? { extra: extraActions(row) } : {}),
      ...(edit.duplicatePage && edit.canDuplicate(row.id) && !full
        ? { duplicate: () => edit.duplicatePage!(row.id) }
        : {}),
      ...(edit.canMove(row.id, -1) ? { moveUp: () => edit.movePage(row.id, -1) } : {}),
      ...(edit.canMove(row.id, 1) ? { moveDown: () => edit.movePage(row.id, 1) } : {}),
      locked: row.locked,
      toggleLock: () => edit.setLocked(row.id, !row.locked),
      ...(edit.removePage && !row.locked
        ? {
            remove: () => {
              const order = rows.map((r) => r.id);
              edit.removePage!(row.id);
              focusRowAfterRemove(order, row.id, (id) => buttons.current.get(id));
            },
          }
        : {}),
    });
  };

  return {
    pages,
    rows,
    drawnIds,
    current,
    setCurrent,
    list,
    registerRow,
    reorder,
    reorderable,
    go,
    onListKey,
    // Absent for a Participant and a Viewer, who see no footer.
    canAdd: !!addPage,
    actionsFor,
    add,
    addLike,
    lastPage,
    full,
  };
}

/** Contents' state, as the hook gives it, with the pictures of the rows near view (the editor's). */
export type PageContents<
  R extends ContentsRowBase,
  P extends { id: string },
  A extends unknown[],
> = ReturnType<typeof usePageContents<R, P, A>> & {
  thumbs: ReadonlyMap<string, ContentsThumb>;
};
