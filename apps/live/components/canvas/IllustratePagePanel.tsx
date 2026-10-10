'use client';

// A page's panel (docs/specs/007-editor/illustrate-pages.md "page panel"): opened from the cog
// above the page's top-right corner, in screen space so it reads at one size whatever the zoom.
// Its name, then its tabs: Page (size, orientation; absent where the page has neither), Background
// (every hover over a swatch previews on the page itself) and the kind's own (Layouts, or an
// article's Style and Text); then the page's actions. It closes on an outside press, Escape, or the canvas
// panning or zooming under it (it would no longer sit by its cog).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  PAGE_NAME_MAX,
  pageHasOrientation,
  pageSizeChoices,
  type LaidOutPage,
  type PageBackground,
} from '@livediagram/document';
import {
  ACTIVE_SEGMENT,
  SEGMENT_TRACK,
  ChevronLeftIcon,
  ChevronRightIcon,
  DuplicateIcon,
  SplitPagesIcon,
  Tooltip,
  TrashIcon,
  useClickOutside,
  useEscape,
  Portal,
} from '@livediagram/ui';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import type { IllustratePageEdits } from '@/hooks/editor/useIllustratePages';
import type { ThemeBackgroundPreset } from '@/lib/illustrate-page-paint';
import type { PageLayoutId } from '@livediagram/templates';
import { LayoutsSection } from './infographic-page-layouts-section';
import { OrientationSection, SizeSection } from './illustrate-page-panel-sections';
import { BackgroundSection } from './page-background-section';

const WIDTH = 304;
const GAP = 6;
// The sheets' own ease (IllustratePages).
const PAGE_EASE_MS = 200;

export type PagePreview = { pageId: string; patch: Partial<PageBackground> } | null;
export type PagePanelTab = 'page' | 'background' | 'layouts' | 'style' | 'text';

const TAB_LABEL: Record<PagePanelTab, string> = {
  page: 'Page',
  background: 'Background',
  layouts: 'Layouts',
  style: 'Style',
  text: 'Text',
};

// The page's tabs: Page while it has a size or orientation to choose (a logo page has neither),
// Background, then the kind's own (an article's Style and Text, any other page's Layouts).
export function pagePanelTabs(page: LaidOutPage): PagePanelTab[] {
  const hasPage = pageSizeChoices(page).length > 1 || pageHasOrientation(page);
  return [
    ...(hasPage ? (['page'] as const) : []),
    'background',
    ...(page.flow ? (['style', 'text'] as const) : (['layouts'] as const)),
  ];
}

export function IllustratePagePanel({
  page,
  count,
  heldByLock = false,
  getAnchor,
  initialTab,
  themeBackgrounds,
  edit,
  onPreview,
  onLayoutPreview,
  onClose,
  articleStyle,
}: {
  page: LaidOutPage;
  // An article page's Style and Text tabs (docs/specs/007-editor/article-pages.md "Article style").
  articleStyle?: (part: 'style' | 'text') => ReactNode;
  count: number;
  // Another page of this page's article is locked (isArticleLocked): its shared edits are held.
  heldByLock?: boolean;
  // The cog the panel hangs from, looked up when placed.
  getAnchor: () => HTMLElement | undefined;
  initialTab: PagePanelTab;
  themeBackgrounds: ThemeBackgroundPreset[];
  edit: IllustratePageEdits;
  onPreview: (preview: PagePreview) => void;
  // A layout shown on the page while its tile is hovered (InfographicLayoutPreview); null clears.
  onLayoutPreview: (layout: PageLayoutId | null) => void;
  onClose: (restoreFocus: boolean) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const mobile = useIsMobileViewport();
  const tabs = pagePanelTabs(page);
  // A tab a page of this kind lacks (Layouts on an article page) opens as its first.
  const [tab, setTab] = useState<PagePanelTab>(tabs.includes(initialTab) ? initialTab : tabs[0]!);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // The anchor lookup is a fresh closure each render: read through a ref so placing stays stable.
  const anchorRef = useRef(getAnchor);
  useLayoutEffect(() => {
    anchorRef.current = getAnchor;
  });
  const place = useCallback(() => {
    const el = anchorRef.current();
    if (!el || !el.isConnected) return;
    const a = el.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 0;
    // Beside the page (right of its cog, so the sheet stays in view for the previews) while
    // there is room; else right-aligned under the cog.
    const beside = a.right + GAP + WIDTH + EDGE <= window.innerWidth;
    const left = beside
      ? a.right + GAP
      : Math.max(EDGE, Math.min(a.right - WIDTH, window.innerWidth - WIDTH - EDGE));
    const want = beside ? a.top : a.bottom + GAP;
    // As high as the window needs to fit it (it then scrolls).
    const top = Math.max(EDGE, Math.min(want, window.innerHeight - h - EDGE));
    setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
  }, []);
  useLayoutEffect(() => {
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [place]);
  // The page moved or changed size: follow its cog once the sheet has eased into place.
  const { x, y, width } = page.rect;
  useEffect(() => {
    const t = window.setTimeout(place, PAGE_EASE_MS + 20);
    return () => window.clearTimeout(t);
  }, [place, x, y, width]);

  // Focus moves into the panel as it opens, so a keyboard user lands in it, not at the far end of
  // the page it is portalled after.
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);

  // A press in a colour popover (portalled out of the panel) is the panel's own.
  useClickOutside(
    panel,
    () => onClose(false),
    true,
    '[data-page-panel-trigger], [data-anchored-popover]',
  );
  // Escape inside a colour popover closes the popover only.
  useEscape(
    () => {
      if (document.activeElement?.closest('[data-anchored-popover]')) return;
      onClose(true);
    },
    { capture: true, stopPropagation: true },
  );
  // A wheel over the canvas pans or zooms it away from the cog: the panel goes with the gesture.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.target instanceof Node && panel.current?.contains(e.target)) return;
      onClose(false);
    };
    window.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, [onClose]);
  // The previews are the panel's: closing it puts the page back.
  useEffect(() => () => onPreview(null), [onPreview]);
  // Only on close: the callback is a fresh closure each render, so it is read through a ref.
  const clearLayoutPreview = useRef(onLayoutPreview);
  useEffect(() => {
    clearLayoutPreview.current = onLayoutPreview;
  });
  useEffect(() => () => clearLayoutPreview.current(null), []);

  const preview = (patch: Partial<PageBackground> | null) =>
    onPreview(patch ? { pageId: page.id, patch } : null);
  const placeLabel = `Page ${page.index + 1}`;
  const title = page.name ?? (count > 1 ? placeLabel : 'Page');
  // A locked page's panel says so, its name and sections unavailable (docs/specs/007-editor/
  // illustrate-pages.md "Locking a page"); moving and duplicating it still work. A page of an
  // article another of whose pages is locked is held too, all but its own name.
  const selfLocked = page.locked === true;
  const locked = selfLocked || heldByLock;
  const body = (
    <>
      {locked ? (
        <p
          role="status"
          className="mx-3 mt-2 rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-500/15 dark:text-amber-100"
        >
          {selfLocked
            ? 'This page is locked. Unlock it beside the cog to change it.'
            : "A page of this article is locked. Unlock it to change the article's pages."}
        </p>
      ) : null}
      <div inert={selfLocked} className={selfLocked ? 'opacity-50' : undefined}>
        <NameField
          key={page.id}
          name={page.name ?? ''}
          placeholder={count > 1 ? placeLabel : 'Untitled page'}
          onRename={(name) => edit.rename(page.id, name)}
        />
      </div>
      <div inert={locked} className={locked ? 'opacity-50' : undefined}>
        <PanelTabs
          tab={tab}
          tabs={tabs}
          onTab={(next) => {
            // Leaving Layouts takes its preview (a pending Replace's too) off the page.
            if (next !== 'layouts') onLayoutPreview(null);
            // Leaving Background takes a hovered swatch's preview off the page.
            if (next !== 'background') onPreview(null);
            setTab(next);
          }}
        />
        {tab === 'page' ? (
          <>
            <SizeSection page={page} onSize={(size) => edit.setSize(page.id, size)} />
            <OrientationSection
              page={page}
              onOrientation={(o) => edit.setOrientation(page.id, o)}
            />
          </>
        ) : tab === 'background' ? (
          <BackgroundSection
            page={page}
            themePresets={themeBackgrounds}
            onBackground={(patch) => {
              edit.setBackground(page.id, patch);
              onPreview(null);
            }}
            onPreview={preview}
          />
        ) : tab === 'style' || tab === 'text' ? (
          (articleStyle?.(tab) ?? null)
        ) : (
          <LayoutsSection
            page={page}
            contentCount={edit.contentCount(page.id)}
            onApply={(layout) => {
              onLayoutPreview(null);
              edit.applyLayout(page.id, layout);
              onClose(false);
            }}
            onPreview={onLayoutPreview}
          />
        )}
      </div>
      <PageActions page={page} locked={locked} edit={edit} onClose={() => onClose(false)} />
    </>
  );
  const label = `${title} settings`;
  // On a phone the panel is a bottom sheet (swipe down to close), the page above it.
  if (mobile) {
    return (
      <BottomSheet
        ref={panel}
        role="dialog"
        aria-label={label}
        data-page-panel
        // The page's own panel: working in it keeps an article's toolbar on its page.
        data-article-keep-active=""
        tabIndex={-1}
        onClose={() => onClose(false)}
        zClassName="z-[var(--z-overlay)]"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {body}
      </BottomSheet>
    );
  }
  return (
    <Portal>
      <div
        ref={panel}
        role="dialog"
        aria-label={label}
        data-page-panel
        // The page's own panel: working in it keeps an article's toolbar on its page.
        data-article-keep-active=""
        tabIndex={-1}
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed z-[var(--z-overlay)] flex outline-none animate-fade-in flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white pb-1 shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
        style={{
          left: pos?.left ?? -9999,
          top: pos?.top ?? -9999,
          width: WIDTH,
          maxHeight: `calc(100vh - ${2 * EDGE}px)`,
        }}
      >
        {body}
      </div>
    </Portal>
  );
}

// The page's tabs (pagePanelTabs): the shared segmented control, its highlight sliding between them.
const GRID_COLS = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4'];
function PanelTabs({
  tab,
  tabs,
  onTab,
}: {
  tab: PagePanelTab;
  tabs: PagePanelTab[];
  onTab: (t: PagePanelTab) => void;
}) {
  return (
    <div className="px-3 pt-2">
      <div
        role="group"
        aria-label="Page panel section"
        className={`relative grid ${GRID_COLS[tabs.length - 1]} rounded-lg p-0.5 ${SEGMENT_TRACK}`}
      >
        <SegmentSlider count={tabs.length} index={tabs.indexOf(tab)} className={ACTIVE_SEGMENT} />
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => onTab(id)}
            className={`relative z-10 rounded-md py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
              tab === id
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>
    </div>
  );
}

// The page's name, renamed as you leave the field, press Enter or close the panel (an outside
// press closes it before the field would blur, so the close commits it too).
function NameField({
  name,
  placeholder,
  onRename,
}: {
  name: string;
  placeholder: string;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(name);
  // A rename from elsewhere (undo, a collaborator) replaces the field's text.
  const [shown, setShown] = useState(name);
  if (shown !== name) {
    setShown(name);
    setDraft(name);
  }
  const latest = useRef({ draft, name, onRename });
  useEffect(() => {
    latest.current = { draft, name, onRename };
  });
  const commit = () => {
    const { draft: d, name: n, onRename: rename } = latest.current;
    if (d.trim() !== n) rename(d);
  };
  useEffect(() => commit, []);
  return (
    <div className="border-b border-slate-100 px-3 pb-2.5 pt-3 dark:border-slate-800">
      <input
        type="text"
        value={draft}
        maxLength={PAGE_NAME_MAX}
        placeholder={placeholder}
        aria-label="Page name"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-slate-900 outline-none transition placeholder:font-medium placeholder:text-slate-400 hover:border-slate-200 focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-100 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:bg-slate-900 dark:focus:ring-brand-500/30"
      />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={!onClick}
        onClick={onClick}
        className={`flex h-8 flex-1 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

// Duplicate, move left, move right, delete: one row of icon buttons, each disabled where it has
// nothing to do (the row's ends, the page limit, the last page). On an article page each acts on
// the whole article, and says so.
function PageActions({
  page,
  locked,
  edit,
  onClose,
}: {
  page: LaidOutPage;
  // The page, or its article, is held by a lock: no split and no delete.
  locked: boolean;
  edit: IllustratePageEdits;
  onClose: () => void;
}) {
  const { duplicatePage, removePage } = edit;
  const noun = page.flow ? 'article' : page.kind === 'slide' ? 'slide' : 'page';
  return (
    <div className="mt-1 flex gap-1 border-t border-slate-100 px-2 pt-1.5 dark:border-slate-800">
      {page.size === 'fit' && (
        <ActionButton
          label="Split Into Pages"
          onClick={!locked ? () => edit.splitPage(page.id) : undefined}
        >
          <SplitPagesIcon className="h-4 w-4" />
        </ActionButton>
      )}
      <ActionButton
        label={`Duplicate ${noun}`}
        onClick={
          duplicatePage && edit.canDuplicate(page.id) ? () => duplicatePage(page.id) : undefined
        }
      >
        <DuplicateIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label={`Move ${noun} left`}
        onClick={edit.canMove(page.id, -1) ? () => edit.movePage(page.id, -1) : undefined}
      >
        <ChevronLeftIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label={`Move ${noun} right`}
        onClick={edit.canMove(page.id, 1) ? () => edit.movePage(page.id, 1) : undefined}
      >
        <ChevronRightIcon className="h-4 w-4" />
      </ActionButton>
      <ActionButton
        label={`Delete ${noun}`}
        onClick={
          removePage && !locked
            ? () => {
                onClose();
                removePage(page.id);
              }
            : undefined
        }
      >
        <TrashIcon className="h-4 w-4" />
      </ActionButton>
    </div>
  );
}
