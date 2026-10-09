'use client';

// An empty infographic page's own invitation (docs/specs/007-editor/illustrate-pages.md "Layouts"):
// the page panel's Layouts, on a card centred inside the page, held at one screen size like the
// first page's kind choice. A layout pressed lands on the page at once. No hover preview here: drawn
// over the page the card sits on, it hid the very tiles being pointed at. Hide puts the card away
// for the page; the host takes it away once anything lands there.
import type { LaidOutPage } from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { CloseIcon, Tooltip } from '@livediagram/ui';
import { DashedAddButton } from '@/components/primitives/DashedAddButton';
import { LayoutBrowser } from './infographic-page-layouts-section';

// The card's width in screen px; the host shows it only on a page with room for it.
export const EMPTY_PAGE_LAYOUTS_WIDTH = 340;

export function EmptyPageLayouts({
  page,
  zoom,
  onApply,
  onHide,
  onBlank,
}: {
  page: LaidOutPage;
  zoom: number;
  onApply: (layout: PageLayoutId) => void;
  onHide: () => void;
  // Blank Logo: the page starts from nothing, and the card is not offered on it again.
  onBlank: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        role="group"
        aria-labelledby={`empty-page-layouts-${page.id}`}
        data-empty-page-layouts={page.id}
        // A press on the card is the card's, never the canvas's (no marquee, no deselect).
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="pointer-events-auto animate-fade-in rounded-xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900"
        style={{
          width: EMPTY_PAGE_LAYOUTS_WIDTH,
          transform: `scale(${1 / zoom})`,
          transformOrigin: 'center',
        }}
      >
        <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
          <p
            id={`empty-page-layouts-${page.id}`}
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            Start From a Layout
          </p>
          <Tooltip label="Hide">
            <button
              type="button"
              aria-label="Hide"
              onClick={onHide}
              className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <CloseIcon />
            </button>
          </Tooltip>
        </div>
        {/* A long category scrolls inside the card rather than running off the page. */}
        <div className="-mr-1 max-h-[380px] overflow-y-auto pr-1">
          <LayoutBrowser page={page} contentCount={0} onApply={onApply} onPreview={() => {}} />
        </div>
        {/* A logo page can start from nothing: the card goes for good on that page, its layouts
            still in its panel (docs/specs/007-editor/logo-pages.md "Logo layouts"). */}
        {page.kind === 'logo' ? (
          <DashedAddButton label="Blank Logo" className="mt-2" onClick={onBlank} />
        ) : null}
      </div>
    </div>
  );
}
