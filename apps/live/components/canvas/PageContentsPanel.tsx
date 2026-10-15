'use client';

// Contents (docs/specs/007-editor/illustrate-pages.md "Contents"): every page of the Illustrate
// tab, a live thumbnail each, the page in view marked; a press glides there. An Editor adds a page
// from its footer. A popover over its cluster button on a desktop (it stays open so a reader can
// hop from page to page), a bottom sheet on a phone (it closes so the page shows).
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { MAX_ILLUSTRATE_PAGES, pageKindOf, type PageKind } from '@livediagram/document';
import {
  lucideFileText,
  lucideGripVertical,
  lucideLock,
  lucidePanelsTopLeft,
  lucidePlus,
  lucideSearch,
  lucideShapes,
} from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip, useEscape } from '@livediagram/ui';
import type { DockAnchor } from '@/lib/canvas-chrome';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { usePageThumbnails, type PageThumbTab } from '@/hooks/ui/usePageThumbnails';
import type { IllustratePagesView } from '@/hooks/editor/useIllustratePages';
import {
  contentsDropUnit,
  contentsRows,
  CONTENTS_FIND_AFTER,
  filterContents,
  pageInView,
  type ContentsRow,
} from '@/lib/page-contents';
import { useViewportStoreIfAny } from '@/hooks/canvas/useViewportStore';
import { track } from '@/lib/telemetry';
import { useRowReorderDrag } from '@/hooks/ui/useRowReorderDrag';
import { DropCaret } from '@/components/primitives/DropCaret';

const LockIcon = lucideGlyph(lucideLock, 12);
const GripIcon = lucideGlyph(lucideGripVertical, 14);
const FindIcon = lucideGlyph(lucideSearch, 14);
const PlusIcon = lucideGlyph(lucidePlus, 14);
const InfographicIcon = lucideGlyph(lucidePanelsTopLeft, 16);
const ArticleIcon = lucideGlyph(lucideFileText, 16);
const LogoIcon = lucideGlyph(lucideShapes, 16);

// A thumbnail's height in the list; its width follows the page's shape, up to THUMB_MAX_W.
const THUMB_H = 52;
const THUMB_MAX_W = 92;

const ADD_KINDS: readonly { kind: PageKind; name: string; icon: () => React.ReactNode }[] = [
  { kind: 'infographic', name: 'Infographic', icon: () => <InfographicIcon /> },
  { kind: 'slide', name: 'Slide', icon: () => <SlideDeckIcon /> },
  { kind: 'article', name: 'Article', icon: () => <ArticleIcon /> },
  { kind: 'logo', name: 'Logo', icon: () => <LogoIcon /> },
];

export function PageContentsPanel({
  view,
  tab,
  anchor,
  onClose,
}: {
  view: IllustratePagesView;
  tab: PageThumbTab;
  anchor?: DockAnchor;
  onClose: () => void;
}) {
  const mobile = useIsMobileViewport();
  const { pages } = view;
  // The page in view as it opens: the one at the middle of the screen, else the nearest.
  const viewport = useViewportStoreIfAny();
  const [here] = useState(() =>
    viewport
      ? pageInView(pages, viewport.get(), { width: window.innerWidth, height: window.innerHeight })
      : pages[0]?.id,
  );
  const [current, setCurrent] = useState(here);
  const [query, setQuery] = useState('');
  const rows = useMemo(
    () =>
      contentsRows(pages, {
        ...(view.deck ? { inDeck: (id: string) => !!view.deck!.slideOf(id) } : {}),
        ...(view.articles ? { articles: view.articles.flows } : {}),
      }),
    [pages, view.deck, view.articles],
  );
  const shown = useMemo(() => filterContents(rows, query), [rows, query]);
  const thumbs = usePageThumbnails(
    tab,
    pages.map((p) => p.id),
  );
  const list = useRef<HTMLDivElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  // A page just added: once it is in the list, it is here, and in view.
  const [added, setAdded] = useState<number | null>(null);

  // Open on the page in view, scrolled to it.
  useLayoutEffect(() => {
    if (here) buttons.current.get(here)?.scrollIntoView({ block: 'center' });
    // On opening only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The page just added, once it is in the list, is here (set while rendering, as React derives
  // state from a change in its inputs).
  if (added !== null && pages.length > added) {
    setAdded(null);
    setCurrent(pages[pages.length - 1]!.id);
  }
  // The marked row kept in view as it moves (a page added, a row pressed).
  useEffect(() => {
    if (current) buttons.current.get(current)?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  // Escape closes the popover (the Find box clears itself first, stopping the key there).
  useEffect(() => {
    if (mobile) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobile, onClose]);

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
    if (mobile) onClose();
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
  const full = pages.length >= MAX_ILLUSTRATE_PAGES;
  // The last page's kind leads the footer, highlighted: the next page is most often the same.
  const lastKind = pages.length ? pageKindOf(pages[pages.length - 1]!) : undefined;
  const add = (kind: PageKind) => {
    if (!view.edit?.addPage || full) return;
    setAdded(pages.length);
    view.edit.addPage(kind);
  };

  // The page count, a badge at the right of the header line.
  const count = (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {pages.length === 1 ? '1 page' : `${pages.length} pages`}
    </span>
  );
  const body = (
    <div className="flex min-h-0 flex-col" data-page-contents="">
      {pages.length > CONTENTS_FIND_AFTER ? (
        <label className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-400 focus-within:border-brand-400 dark:border-slate-700 dark:bg-slate-900">
          <FindIcon />
          <input
            type="search"
            value={query}
            placeholder="Find a Page"
            aria-label="Find a Page"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && query) {
                e.stopPropagation();
                setQuery('');
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (shown[0]) buttons.current.get(shown[0].id)?.focus();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
        </label>
      ) : null}
      <div
        ref={list}
        role="listbox"
        aria-label="Pages"
        onKeyDown={onListKey}
        className="flex min-h-0 flex-col gap-0.5 overflow-y-auto px-2 pb-2"
        style={{ maxHeight: mobile ? '55vh' : 'min(calc(100vh - 360px), 480px)' }}
      >
        {shown.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
            No page matches “{query}”.
          </p>
        ) : null}
        {shown.map((row, i) => {
          const isHere = row.id === current;
          const dragged = reorder.moving && reorder.draggingId === row.id;
          const thumb = thumbs.get(row.id);
          const w = Math.min(THUMB_MAX_W, Math.round(THUMB_H * row.aspect));
          const h = Math.round(w / row.aspect);
          return (
            <Fragment key={row.id}>
              {reorder.caretBefore(i) ? <DropCaret /> : null}
              <button
                ref={(el) => {
                  if (el) buttons.current.set(row.id, el);
                  else buttons.current.delete(row.id);
                }}
                type="button"
                role="option"
                aria-selected={isHere}
                data-page-row={row.id}
                data-contents-slot={i}
                onClick={(e) => go(row, e.timeStamp)}
                // A mouse or pen drags the whole row; a finger drags its grip, so the list still scrolls.
                onPointerDown={(e) => {
                  if (e.pointerType !== 'touch') reorder.beginDrag(e, row.id);
                }}
                onPointerMove={reorder.moveDrag}
                onPointerUp={reorder.endDrag}
                onPointerCancel={reorder.endDrag}
                className={`group relative flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
                  dragged ? 'opacity-50 ' : ''
                }${
                  isHere
                    ? 'bg-brand-50 dark:bg-brand-500/15'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {isHere ? (
                  <span
                    aria-hidden
                    className="absolute inset-y-2 left-0 w-1 rounded-full bg-brand-500"
                  />
                ) : null}
                <span className="flex w-7 shrink-0 flex-col items-center">
                  <span
                    className={`text-sm font-semibold tabular-nums ${isHere ? 'text-brand-700 dark:text-brand-200' : 'text-slate-400 dark:text-slate-400'}`}
                  >
                    {row.number}
                  </span>
                  {isHere ? (
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
                      Here
                    </span>
                  ) : null}
                </span>
                <span
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: THUMB_MAX_W, height: THUMB_H + 4 }}
                >
                  <span
                    className={`block overflow-hidden rounded-md bg-white shadow-sm ring-1 transition group-hover:shadow-md dark:bg-slate-800 ${
                      isHere ? 'ring-brand-400' : 'ring-slate-900/10 dark:ring-white/15'
                    }`}
                    style={{ width: w, height: h }}
                  >
                    {thumb ? (
                      <svg
                        aria-hidden
                        width={w}
                        height={h}
                        viewBox={thumb.viewBox}
                        preserveAspectRatio="xMidYMid slice"
                        // Our own renderer's output (every label is xmlEscaped inside it).
                        dangerouslySetInnerHTML={{ __html: thumb.markup }}
                      />
                    ) : null}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                      {row.name}
                    </span>
                    {row.locked ? (
                      <span className="shrink-0 text-slate-400" aria-label="Locked">
                        <LockIcon />
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {row.line}
                  </span>
                </span>
                {reorderable ? (
                  <span
                    aria-hidden
                    data-contents-grip=""
                    onPointerDown={(e) => {
                      if (e.pointerType === 'touch') reorder.beginDrag(e, row.id);
                    }}
                    className={`flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-slate-400 transition ${
                      mobile ? '' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <GripIcon />
                  </span>
                ) : null}
              </button>
            </Fragment>
          );
        })}
        {reorder.caretAfterLast ? <DropCaret /> : null}
      </div>
      {view.edit?.addPage ? (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2.5 dark:border-slate-800">
          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <PlusIcon />
            Add Page
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {(lastKind
              ? [
                  ...ADD_KINDS.filter((k) => k.kind === lastKind),
                  ...ADD_KINDS.filter((k) => k.kind !== lastKind),
                ]
              : ADD_KINDS
            ).map(({ kind, name, icon }) => (
              <Tooltip
                key={kind}
                label={
                  full ? `A tab holds up to ${MAX_ILLUSTRATE_PAGES} pages` : `Add a ${name} page`
                }
              >
                <button
                  type="button"
                  disabled={full}
                  aria-label={`Add a ${name} page`}
                  onClick={() => add(kind)}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[11px] font-medium transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40 dark:hover:border-brand-400/60 dark:hover:bg-brand-500/20 dark:hover:text-brand-100 ${
                    kind === lastKind
                      ? 'border-brand-400 bg-brand-50 text-brand-700 ring-2 ring-brand-400/30 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-100'
                      : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  {icon()}
                  {name}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );

  if (mobile)
    return (
      <ContentsSheet onClose={onClose} count={count}>
        {body}
      </ContentsSheet>
    );
  return (
    <MovablePanel
      title="Contents"
      position={null}
      defaultCorner="bottom-right"
      onMoveTo={NO_MOVE}
      popoverOpen
      popoverAnchor={anchor}
      asPopover
      popoverWidth="w-[380px]"
      dismissOnOutside
      onPopoverClose={onClose}
      headerActions={count}
    >
      {body}
    </MovablePanel>
  );
}

const NO_MOVE = () => {};

// On a phone: the list in a bottom sheet, named, closed by a swipe down, an outside press or Escape.
function ContentsSheet({
  onClose,
  count,
  children,
}: {
  onClose: () => void;
  count: React.ReactNode;
  children: React.ReactNode;
}) {
  useEscape(onClose, { capture: true, stopPropagation: true });
  return (
    <BottomSheet
      role="dialog"
      aria-label="Contents"
      onClose={onClose}
      zClassName="z-[var(--z-overlay)]"
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-0.5">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Contents</p>
        {count}
      </div>
      {children}
    </BottomSheet>
  );
}
