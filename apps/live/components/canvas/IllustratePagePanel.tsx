'use client';

// A page's panel (docs/specs/007-editor/illustrate-pages.md "page panel"): opened from the cog
// above the page's top-right corner, in screen space so it reads at one size whatever the zoom.
// Its name, then two tabs: Page (size, orientation, background; every hover over a background
// previews on the page itself) and Layouts; then the page's actions. It closes on an outside press, Escape, or the canvas
// panning or zooming under it (it would no longer sit by its cog).
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PAGE_NAME_MAX, type LaidOutPage, type PageBackground } from '@livediagram/document';
import {
  ACTIVE_SEGMENT,
  SEGMENT_TRACK,
  ChevronLeftIcon,
  ChevronRightIcon,
  DuplicateIcon,
  Tooltip,
  TrashIcon,
  useClickOutside,
  useEscape,
} from '@livediagram/ui';
import { Portal } from '@/components/primitives/Portal';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';
import { BottomSheet } from '@/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { VIEWPORT_EDGE_MARGIN as EDGE } from '@/lib/clamp-to-viewport';
import type { IllustratePageEdits } from '@/hooks/editor/useIllustratePages';
import type { ThemeBackgroundPreset } from '@/lib/illustrate-page-paint';
import type { PageLayoutId } from '@livediagram/templates';
import { LayoutsSection } from './infographic-page-layouts-section';
import {
  BackgroundSection,
  OrientationSection,
  SizeSection,
} from './illustrate-page-panel-sections';

const WIDTH = 304;
const GAP = 6;
// The sheets' own ease (IllustratePages).
const PAGE_EASE_MS = 200;

export type PagePreview = { pageId: string; patch: Partial<PageBackground> } | null;
export type PagePanelTab = 'page' | 'layouts' | 'style';

export function IllustratePagePanel({
  page,
  count,
  getAnchor,
  initialTab,
  themeBackgrounds,
  edit,
  onPreview,
  onLayoutPreview,
  onClose,
  documentStyle = null,
}: {
  page: LaidOutPage;
  // A document page's Style tab (docs/specs/007-editor/document-pages.md "Document style").
  documentStyle?: ReactNode;
  count: number;
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
  // A tab a page of this kind lacks (Layouts on a document page) opens as Page.
  const [tab, setTab] = useState<PagePanelTab>(
    (initialTab === 'layouts' && page.flow) || (initialTab === 'style' && !page.flow)
      ? 'page'
      : initialTab,
  );
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

  useClickOutside(panel, () => onClose(false), true, '[data-page-panel-trigger]');
  useEscape(() => onClose(true), { capture: true, stopPropagation: true });
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
  const body = (
    <>
      <NameField
        key={page.id}
        name={page.name ?? ''}
        placeholder={count > 1 ? placeLabel : 'Untitled page'}
        onRename={(name) => edit.rename(page.id, name)}
      />
      <PanelTabs
        tab={tab}
        document={!!page.flow}
        onTab={(next) => {
          // Leaving Layouts takes its preview (a pending Replace's too) off the page.
          if (next !== 'layouts') onLayoutPreview(null);
          setTab(next);
        }}
      />
      {tab === 'page' ? (
        <>
          <SizeSection page={page} onSize={(size) => edit.setSize(page.id, size)} />
          <OrientationSection page={page} onOrientation={(o) => edit.setOrientation(page.id, o)} />
          <BackgroundSection
            page={page}
            themePresets={themeBackgrounds}
            onBackground={(patch) => {
              edit.setBackground(page.id, patch);
              onPreview(null);
            }}
            onPreview={preview}
          />
        </>
      ) : tab === 'style' ? (
        documentStyle
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
      <PageActions page={page} edit={edit} onClose={() => onClose(false)} />
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

// Page (its size and paint) or Layouts (what to start it with): the shared segmented control,
// its highlight sliding between the two.
function PanelTabs({
  tab,
  document,
  onTab,
}: {
  tab: PagePanelTab;
  // A document page's second tab is Style; an infographic page's is Layouts.
  document: boolean;
  onTab: (t: PagePanelTab) => void;
}) {
  const tabs: [PagePanelTab, string][] = [
    ['page', 'Page'],
    document ? ['style', 'Style'] : ['layouts', 'Layouts'],
  ];
  return (
    <div className="px-3 pt-2">
      <div
        role="group"
        aria-label="Page panel section"
        className={`relative grid grid-cols-2 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
      >
        <SegmentSlider
          count={tabs.length}
          index={tabs.findIndex(([id]) => id === tab)}
          className={ACTIVE_SEGMENT}
        />
        {tabs.map(([id, label]) => (
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
            {label}
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
  danger = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        disabled={!onClick}
        onClick={onClick}
        className={`flex h-8 flex-1 items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent ${
          danger
            ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
        }`}
      >
        {children}
      </button>
    </Tooltip>
  );
}

// Duplicate, move left, move right, delete: one row of icon buttons, each disabled where it has
// nothing to do (the row's ends, the page limit, the last page). On a document page each acts on
// the whole document, and says so.
function PageActions({
  page,
  edit,
  onClose,
}: {
  page: LaidOutPage;
  edit: IllustratePageEdits;
  onClose: () => void;
}) {
  const { duplicatePage, removePage } = edit;
  const noun = page.flow ? 'document' : 'page';
  return (
    <div className="mt-1 flex gap-1 border-t border-slate-100 px-2 pt-1.5 dark:border-slate-800">
      <ActionButton
        label={`Duplicate ${noun}`}
        onClick={duplicatePage ? () => duplicatePage(page.id) : undefined}
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
        danger
        onClick={
          removePage
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
