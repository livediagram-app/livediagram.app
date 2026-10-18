'use client';

// The page panel's Layouts (docs/specs/007-editor/pages-mode.md "Layouts", "Slide layouts"):
// the page's catalogue (a slide page's slide layouts, else the infographic ones) by
// category, as /new browses templates: the categories first (each a card fronted by its first
// layout, with a count), then one category's layouts, each previewed for this page, with a way
// back, each move sliding in from its side. A press places the layout at once, over anything on the page (one undo
// step brings it back). Hovering a tile previews it on the page (InfographicLayoutPreview).
import { useEffect, useState } from 'react';
import { pageKindOf, type LaidOutPage } from '@livediagram/document';
import {
  layoutCatalogueFor,
  warmLayoutPlaceholders,
  type PageLayoutId,
} from '@livediagram/templates';
import { CountBadge } from '@livediagram/ui';
import { LayoutThumb } from './infographic-layout-thumb';
import { BackBar } from '@/components/primitives/BackBar';
import { PanelSection } from './page-panel-sections';
import { prefetchWhenIdle } from '@/lib/idle-prefetch';

// The placeholders a page's carried content is told apart from, gathered once while the layouts
// are open and idle, so the first hover preview (or press) does not wait on them.
const warmPlaceholders = async () => warmLayoutPlaceholders();

type LayoutBrowserProps = {
  page: LaidOutPage;
  onApply: (layout: PageLayoutId) => void;
  // Shows a layout on the page while its tile is hovered or focused; null takes it away.
  onPreview: (layout: PageLayoutId | null) => void;
  // Four across (the wide in-page card, so a category's layouts need no scrolling), else two.
  wide?: boolean;
};

// A category card's two front layouts' width: as large as the card's art box holds an A4 page.
const FAN_THUMB_W = 74;

// A layout tile's art width in the wide card's four columns.
const WIDE_THUMB_W = 104;

export function LayoutsSection(props: LayoutBrowserProps) {
  return (
    <PanelSection title="Start From a Layout">
      <LayoutBrowser {...props} />
    </PanelSection>
  );
}

/** The layouts by category, then one category's layouts: the panel's Layouts section, and the
 *  card an empty infographic page shows inside itself (EmptyPageLayouts). */
export function LayoutBrowser({ page, onApply, onPreview, wide = false }: LayoutBrowserProps) {
  const cols = wide ? 'grid-cols-4' : 'grid-cols-2';
  // The category open, or null for the overview of categories.
  const [category, setCategory] = useState<string | null>(null);
  // Which way the last move went, so the view slides in from that side: into a category from the
  // right, back to the categories from the left (the template wizard's own slide). None at first.
  const [moved, setMoved] = useState<'in' | 'back' | null>(null);
  const slide = moved === 'in' ? 'animate-tip-next' : moved === 'back' ? 'animate-tip-prev' : '';
  const { categories, layouts } = layoutCatalogueFor(pageKindOf(page));
  useEffect(() => prefetchWhenIdle([warmPlaceholders]), []);
  const openCategory = categories.find((c) => c.id === category);
  // A press places the layout at once, over whatever the page holds: one undo step brings it back.
  const pick = (id: PageLayoutId) => onApply(id);
  return (
    <>
      {openCategory ? (
        <div key={openCategory.id} className={slide}>
          <BackBar
            label="All layouts"
            current={openCategory.label}
            gap="tight"
            onClick={() => {
              setMoved('back');
              setCategory(null);
              onPreview(null);
            }}
          />
          <div
            className={`grid ${cols} gap-2`}
            onPointerLeave={() => onPreview(null)}
            onBlur={() => onPreview(null)}
          >
            {layouts
              .filter((l) => l.category === openCategory.id)
              .map((l) => (
                <button
                  key={l.id}
                  type="button"
                  data-layout-tile={l.id}
                  onClick={() => pick(l.id)}
                  onPointerEnter={() => onPreview(l.id)}
                  onFocus={() => onPreview(l.id)}
                  className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800 `}
                >
                  <LayoutThumb
                    layout={l.id}
                    page={page}
                    {...(wide ? { width: WIDE_THUMB_W } : {})}
                  />
                  {l.label}
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div key="categories" className={`grid ${cols} gap-2 ${slide}`}>
          {categories.map((c) => {
            const members = layouts.filter((l) => l.category === c.id);
            // A category with nothing in it yet is not offered.
            if (members.length === 0) return null;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setMoved('in');
                  setCategory(c.id);
                }}
                className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 p-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/5 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-800"
              >
                {/* Fronted by its first two layouts, the second peeking behind the first: drawn
                    upright on whole pixels (a rotated render of tiny type blurs), in a clipped box
                    of fixed height, so they never spill out of the card. */}
                <span
                  aria-hidden
                  className="relative flex h-28 w-full items-center justify-center overflow-hidden"
                >
                  {members.slice(0, 2).map((l, i) => (
                    <span
                      key={l.id}
                      className="absolute flex"
                      style={{
                        transform: `translate(${i === 0 ? -12 : 12}px, ${i === 0 ? 3 : -3}px)`,
                        zIndex: i === 0 ? 1 : 0,
                      }}
                    >
                      <LayoutThumb layout={l.id} page={page} width={FAN_THUMB_W} />
                    </span>
                  ))}
                </span>
                <span className="flex items-center gap-1.5">
                  {c.label}
                  <CountBadge count={members.length} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
