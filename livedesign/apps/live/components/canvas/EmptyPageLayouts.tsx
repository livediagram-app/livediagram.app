'use client';

// An empty page's own invitation (docs/specs/007-editor/pages-mode.md "An empty page offers its
// layouts"): the layout gallery on a card centred inside the page, as large as the page on screen
// leaves room for (layoutCardSize) and held at that screen size whatever the zoom. A layout pressed
// lands on the page at once. No hover preview here: drawn over the page the card sits on, it hid
// the very tiles being pointed at. Hide puts the card away for the page; the host takes it away
// once anything lands there. Where the card has no room, the page shows EmptyPageInvite instead.
// The card keeps to its layouts: Change Theme is the Layout popover's alone.
import { lucideSparkles } from '@livedesign/icons/lucide';
import { pageDeviceClass, pageKindOf, type LaidOutPage } from '@livedesign/document';
import { layoutCatalogueFor, type PageLayoutId } from '@livedesign/templates';
import { CloseIcon, lucideGlyph, Tooltip } from '@livedesign/ui';
import { DashedAddButton } from '@/components/primitives/DashedAddButton';
import { LayoutGallery } from './layout-gallery/LayoutGallery';
import { layoutCardSize } from './page-layout-card';

const SparklesIcon = lucideGlyph(lucideSparkles, 18);

// The card's header, search and chips (and a logo page's Start From Scratch): what the gallery's
// scrolling area leaves of the card's height.
const CARD_CHROME_HEIGHT = 168;
const LOGO_SCRATCH_HEIGHT = 48;
// Wide enough to read each tile's description under its name, and for the header's badge beside
// its title (narrower, the title takes the room).
const DESCRIBED_MIN_WIDTH = 520;

// What the card calls a page's layouts, by its kind.
const KIND_NOUN = {
  slide: 'slide',
  logo: 'logo',
  wireframe: 'screen',
  infographic: 'page',
  article: 'page',
} as const;

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
  // Start From Scratch: the page starts from nothing, and the card is not offered on it again.
  onBlank: () => void;
}) {
  const { width, height } = layoutCardSize(page, zoom);
  const kind = pageKindOf(page);
  const count = layoutCatalogueFor(kind, pageDeviceClass(page)).layouts.length;
  const logo = page.kind === 'logo';
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        role="group"
        aria-labelledby={`empty-page-layouts-${page.id}`}
        data-empty-page-layouts={page.id}
        // A press on the card is the card's, never the canvas's (no marquee, no deselect).
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative flex animate-dialog-in flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40"
        style={{
          width,
          maxHeight: height,
          transform: `scale(${1 / zoom})`,
          transformOrigin: 'center',
        }}
      >
        {/* A soft wash of the brand behind the header: the card's one flourish. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-brand-50 to-transparent dark:from-brand-500/10"
        />
        <div className="relative mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {width >= DESCRIBED_MIN_WIDTH ? (
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-md shadow-brand-900/20"
              >
                <SparklesIcon />
              </span>
            ) : null}
            <div className="min-w-0">
              <p
                id={`empty-page-layouts-${page.id}`}
                className="whitespace-nowrap text-base font-semibold text-slate-900 dark:text-slate-50"
              >
                Start From a Layout
              </p>
              <p className="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                {count} {KIND_NOUN[kind]} layouts in your theme. Pick one, then make it yours.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip label="Hide">
              <button
                type="button"
                aria-label="Hide"
                onClick={onHide}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <CloseIcon />
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="relative min-h-0">
          <LayoutGallery
            page={page}
            onApply={onApply}
            onPreview={() => {}}
            described={width >= DESCRIBED_MIN_WIDTH}
            maxHeight={`${Math.max(160, height - CARD_CHROME_HEIGHT - (logo ? LOGO_SCRATCH_HEIGHT : 0))}px`}
          />
        </div>
        {/* A logo page can start from nothing: the card goes for good on that page, its layouts
            still in its panel (docs/specs/007-editor/logo-pages.md "Logo layouts"). */}
        {logo ? (
          <DashedAddButton label="Start From Scratch" className="mt-2" onClick={onBlank} />
        ) : null}
      </div>
    </div>
  );
}
