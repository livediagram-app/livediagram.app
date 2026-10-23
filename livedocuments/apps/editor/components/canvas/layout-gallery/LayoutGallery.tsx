'use client';

// The layout gallery (docs/specs/007-editor/pages-mode.md "The layout gallery"): every layout a
// page can start from, at once, drawn in the tab's theme. A search and Surprise Me along the top,
// category chips under them (All first), then the layouts in large tiles, in sections by category
// under All. A press places the layout at once, over anything on the page (one undo step brings it
// back); hovering or focusing a tile previews it on the page where the host shows one. One gallery
// for every place a layout is chosen: the empty page's card, the title bar's Layout popover, the
// page panel's Layouts tab and a phone's sheet.
import { useEffect, useMemo, useRef, useState } from 'react';
import { lucideDices } from '@livedocuments/icons/lucide';
import { pageKindOf, type LaidOutPage } from '@livedocuments/document';
import {
  layoutCatalogueFor,
  warmLayoutPlaceholders,
  type PageLayoutId,
} from '@livedocuments/templates';
import { lucideGlyph, NoMatches, Tooltip } from '@livedocuments/ui';
import { FilterSearchBox } from '@/components/primitives/FilterSearchBox';
import { prefetchWhenIdle } from '@/lib/idle-prefetch';
import { track } from '@/lib/telemetry';
import { LayoutTile } from './LayoutTile';
import {
  ALL_LAYOUTS,
  categoryCounts,
  gallerySections,
  surprisePick,
} from './layout-gallery-filter';
import { useTileWidth } from './useTileWidth';

const DicesIcon = lucideGlyph(lucideDices, 15);

// The placeholders a page's carried content is told apart from, gathered once while the gallery
// is open and idle, so the first hover preview (or press) does not wait on them.
const warmPlaceholders = async () => warmLayoutPlaceholders();

// The least a tile's preview is wide, by the page's shape: a landscape slide reads at this width,
// a tall page needs less to show the same (it is drawn taller).
const MIN_TILE_LANDSCAPE = 156;
const MIN_TILE_PORTRAIT = 112;
// The gap between tiles, and the tile's padding round its preview (LayoutTile's p-1.5).
const TILE_GAP = 8;
const TILE_PAD = 12;

export type LayoutGalleryProps = {
  page: LaidOutPage;
  onApply: (layout: PageLayoutId) => void;
  // Shows a layout on the page while its tile is hovered or focused; null takes it away.
  onPreview: (layout: PageLayoutId | null) => void;
  // Surprise Me's pick; absent, it is placed as a press is. A host that closes on a press passes
  // one that places without closing, so the person can roll again and watch the page change.
  onSurprise?: (layout: PageLayoutId) => void;
  // How tall the scrolling area may grow, in CSS (the host's room).
  maxHeight?: string;
  // Each tile's description under its name, where the gallery is wide enough to read it.
  described?: boolean;
  // The search takes the keyboard as the gallery opens (a desktop popover or card, never a phone,
  // whose keyboard would cover it).
  autoFocus?: boolean;
};

export function LayoutGallery({
  page,
  onApply,
  onPreview,
  onSurprise = onApply,
  maxHeight = '420px',
  described = false,
  autoFocus = false,
}: LayoutGalleryProps) {
  const { categories, layouts } = layoutCatalogueFor(pageKindOf(page));
  const [category, setCategory] = useState<string>(ALL_LAYOUTS);
  const [query, setQuery] = useState('');
  const [rolling, setRolling] = useState(false);
  const lastSurprise = useRef<PageLayoutId | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => prefetchWhenIdle([warmPlaceholders]), []);
  const sections = useMemo(
    () => gallerySections(layouts, categories, category, query),
    [layouts, categories, category, query],
  );
  const chips = useMemo(() => categoryCounts(layouts, categories), [layouts, categories]);
  const portrait = page.rect.height > page.rect.width;
  const {
    ref: grid,
    cols,
    tileWidth,
  } = useTileWidth(portrait ? MIN_TILE_PORTRAIT : MIN_TILE_LANDSCAPE, TILE_GAP);
  const thumbWidth = Math.max(40, Math.floor(tileWidth - TILE_PAD));
  const pick = (id: PageLayoutId) => onApply(id);
  // A new choice of what to show starts at the top of it.
  const toTop = () => {
    if (scroller.current) scroller.current.scrollTop = 0;
  };
  const choose = (id: string) => {
    setCategory(id);
    toTop();
  };
  const surprise = () => {
    const id = surprisePick(
      sections.flatMap((s) => s.layouts),
      lastSurprise.current,
      Math.random(),
    );
    if (!id) return;
    lastSurprise.current = id;
    track('Tab', 'Changed', 'PageLayoutSurprise');
    setRolling(true);
    onPreview(null);
    onSurprise(id);
  };
  const shownCount = sections.reduce((n, s) => n + s.layouts.length, 0);
  return (
    <div data-layout-gallery="" className="flex min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <div className="min-w-0 flex-1">
          <FilterSearchBox
            query={query}
            onQuery={(q) => {
              setQuery(q);
              toTop();
            }}
            chips={[]}
            onClear={() => setQuery('')}
            placeholder={`Search ${layouts.length} layouts`}
            ariaLabel="Search layouts"
            autoFocus={autoFocus}
          />
        </div>
        <Tooltip label="A random layout from those shown">
          <button
            type="button"
            onClick={surprise}
            disabled={shownCount === 0}
            className="flex h-[30px] shrink-0 items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-400/30 dark:hover:bg-brand-500/25"
          >
            <span
              aria-hidden
              className={rolling ? 'animate-dice-roll' : ''}
              onAnimationEnd={() => setRolling(false)}
            >
              <DicesIcon />
            </span>
            Surprise Me
          </button>
        </Tooltip>
      </div>
      <div
        role="group"
        aria-label="Layout categories"
        className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((c) => {
          const on = c.id === category;
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => choose(c.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
                on
                  ? 'bg-brand-700 text-white shadow-sm dark:bg-brand-600'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {c.label}
              <span
                className={`tabular-nums text-[10px] ${on ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {c.count}
              </span>
            </button>
          );
        })}
      </div>
      <div
        ref={scroller}
        className="-mx-1 min-h-0 overflow-y-auto px-1"
        style={{ maxHeight }}
        onPointerLeave={() => onPreview(null)}
        onBlur={() => onPreview(null)}
      >
        <div ref={grid}>
          {sections.length === 0 ? (
            <NoMatches
              things="layouts"
              query={query}
              onClear={() => setQuery('')}
              className="py-8"
            />
          ) : (
            // Keyed by what is shown, so a new choice cascades in afresh.
            <div key={`${category}|${query}`} className="animate-view-forward">
              {sections.map((s) => (
                <section key={s.id ?? 'results'} aria-label={s.label ?? 'Layouts'}>
                  {s.label ? (
                    <h3 className="sticky top-0 z-10 flex items-baseline gap-2 bg-white/95 px-1.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 backdrop-blur-sm dark:bg-slate-900/95 dark:text-slate-400">
                      {s.label}
                      <span className="font-normal tabular-nums">{s.layouts.length}</span>
                    </h3>
                  ) : null}
                  <div
                    className="lvd-cascade grid pb-2"
                    style={{
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      columnGap: TILE_GAP,
                      rowGap: TILE_GAP / 2,
                    }}
                  >
                    {s.layouts.map((l) => (
                      <LayoutTile
                        key={l.id}
                        layout={l}
                        page={page}
                        width={thumbWidth}
                        described={described}
                        scrollRoot={scroller}
                        onPick={pick}
                        onPreview={onPreview}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
