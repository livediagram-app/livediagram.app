'use client';

// The page panel's Layouts (docs/specs/007-editor/illustrate-pages.md "Layouts"): the layouts by
// category, as /new browses templates: the categories first (each a card fronted by its first
// layout, with a count), then one category's layouts, each previewed for this page, with a way
// back. Onto an empty page a press places it at once; onto
// a page with content the grid asks first, inline, naming how much would go. Hovering a tile
// previews it on the page (InfographicLayoutPreview); the pending one stays previewed while asked.
import { useState } from 'react';
import type { LaidOutPage } from '@livediagram/document';
import {
  PAGE_LAYOUT_CATEGORIES,
  PAGE_LAYOUTS,
  type PageLayoutCategoryId,
  type PageLayoutId,
} from '@livediagram/templates';
import { ChevronLeftIcon } from '@livediagram/ui';
import { CountBadge } from '@livediagram/ui';
import { Button } from '@livediagram/ui';
import { LayoutThumb } from './infographic-layout-thumb';
import { PanelSection } from './illustrate-page-panel-sections';

type LayoutBrowserProps = {
  page: LaidOutPage;
  contentCount: number;
  onApply: (layout: PageLayoutId) => void;
  // Shows a layout on the page while its tile is hovered or focused; null takes it away.
  onPreview: (layout: PageLayoutId | null) => void;
};

export function LayoutsSection(props: LayoutBrowserProps) {
  return (
    <PanelSection title="Start from a layout">
      <LayoutBrowser {...props} />
    </PanelSection>
  );
}

/** The layouts by category, then one category's layouts: the panel's Layouts section, and the
 *  card an empty infographic page shows inside itself (EmptyPageLayouts). */
export function LayoutBrowser({ page, contentCount, onApply, onPreview }: LayoutBrowserProps) {
  const [pending, setPending] = useState<PageLayoutId | null>(null);
  // The category open, or null for the overview of categories.
  const [category, setCategory] = useState<PageLayoutCategoryId | null>(null);
  const openCategory = PAGE_LAYOUT_CATEGORIES.find((c) => c.id === category);
  const pick = (id: PageLayoutId) => {
    if (contentCount === 0) onApply(id);
    else setPending(id);
  };
  const pendingLabel = PAGE_LAYOUTS.find((l) => l.id === pending)?.label;
  return (
    <>
      {pending ? (
        <div
          role="alertdialog"
          aria-label="Replace this page's content?"
          className="mb-2 rounded-lg bg-amber-50 p-2.5 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30"
        >
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            Replace this page&apos;s content?
          </p>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
            {contentCount === 1 ? 'The 1 element' : `The ${contentCount} elements`} on it make way
            for {pendingLabel}. Undo brings them back.
          </p>
          <div className="mt-2 flex justify-end gap-1.5">
            <Button
              size="xs"
              variant="secondary"
              onClick={() => {
                setPending(null);
                onPreview(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              autoFocus
              onClick={() => {
                onApply(pending);
                setPending(null);
              }}
            >
              Replace
            </Button>
          </div>
        </div>
      ) : null}
      {openCategory ? (
        <>
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              onPreview(pending);
            }}
            className="mb-2 flex w-full items-center gap-1 rounded-md px-1 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            <span className="text-slate-500 dark:text-slate-400">All layouts</span>
            <span aria-hidden className="text-slate-300 dark:text-slate-600">
              /
            </span>
            {openCategory.label}
          </button>
          <div
            className="grid grid-cols-3 gap-1.5"
            onPointerLeave={() => onPreview(pending)}
            onBlur={() => onPreview(pending)}
          >
            {PAGE_LAYOUTS.filter((l) => l.category === openCategory.id).map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => pick(l.id)}
                onPointerEnter={() => onPreview(l.id)}
                onFocus={() => onPreview(l.id)}
                aria-pressed={pending === l.id}
                className={`flex flex-col items-center gap-1 rounded-lg p-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-200 dark:hover:bg-slate-800 ${
                  pending === l.id ? 'bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-500/15' : ''
                }`}
              >
                <LayoutThumb layout={l.id} page={page} />
                {l.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {PAGE_LAYOUT_CATEGORIES.map((c) => {
            const members = PAGE_LAYOUTS.filter((l) => l.category === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className="flex flex-col items-center gap-1.5 rounded-lg bg-slate-50 p-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-900/5 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 dark:bg-slate-800/60 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-800"
              >
                {/* Fronted by its first two layouts, fanned as /new fans a shelf: drawn small,
                    in a clipped box of fixed height, so they never spill out of the card. */}
                <span
                  aria-hidden
                  className="relative flex h-20 w-full items-center justify-center overflow-hidden"
                >
                  {members.slice(0, 2).map((l, i) => (
                    <span
                      key={l.id}
                      className="absolute flex"
                      style={{
                        transform: `translateX(${i === 0 ? -10 : 10}px) rotate(${i === 0 ? -5 : 5}deg)`,
                        zIndex: i === 0 ? 1 : 0,
                      }}
                    >
                      <LayoutThumb layout={l.id} page={page} width={44} />
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
