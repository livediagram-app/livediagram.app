'use client';

// The page panel's sections (docs/specs/007-editor/pages-mode.md "Sizes"): size tiles and
// the orientation switch (the Background section is page-background-section.tsx). Each hover previews on the page
// itself (`onPreview`), and a press commits; leaving the section drops the preview.
import type { ReactNode } from 'react';
import {
  PAGE_SIZES,
  pageDimensions,
  pageHasOrientation,
  pageSizeChoices,
  type Page,
  type PageOrientation,
  type PageSizeId,
} from '@livedesign/design';
import { ACTIVE_SEGMENT, Glyph, SEGMENT_TRACK, Tooltip } from '@livedesign/ui';
import { SegmentSlider } from '@/components/primitives/SegmentSlider';

export function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-3 py-2">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

// Short tile names: the full name is the tile's tooltip and the page label.
const SIZE_TILE: Record<PageSizeId, { label: string; hint: string }> = {
  a4: { label: 'A4', hint: 'A4 paper, for print' },
  logo: { label: 'Logo', hint: 'Logo artboard (1024 x 1024)' },
  device: { label: 'Device', hint: 'A wireframe page is its device' },
  photo: { label: 'Photo', hint: "The picture's own size" },
  fit: { label: 'Fit', hint: 'Sized around the board it was made for' },
};

// A size drawn to scale in a 28 px box, in the page's current orientation (Fit to Content in
// the page's own sides).
function SizeGlyph({ size, page }: { size: PageSizeId; page: Page }) {
  const sides = pageDimensions({ ...page, size });
  const scale = 24 / Math.max(sides.width, sides.height);
  const [w, h] = [sides.width * scale, sides.height * scale];
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <rect
        x={14 - w / 2}
        y={14 - h / 2}
        width={w}
        height={h}
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.12"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export const tileClass = (active: boolean) =>
  `flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition focus-visible:outline-2 focus-visible:outline-brand-600 ${
    active
      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 dark:bg-brand-500/15 dark:text-brand-200 dark:ring-brand-500/40'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export function SizeSection({ page, onSize }: { page: Page; onSize: (size: PageSizeId) => void }) {
  const current = page.size ?? 'a4';
  // The tiles sit four to a row. A logo page has its one artboard, so no choice to show. Fit to Content is offered only on a page already in it,
  // first, and no two tiles share a shape (docs/specs/007-editor/pages-mode.md "Sizes").
  const sizes = pageSizeChoices(page);
  if (sizes.length < 2) return null;
  return (
    <PanelSection title="Size">
      <div role="radiogroup" aria-label="Page size" className="grid grid-cols-4 gap-1">
        {sizes.map((id) => (
          <Tooltip key={id} label={SIZE_TILE[id].hint}>
            <button
              type="button"
              role="radio"
              aria-checked={current === id}
              aria-label={PAGE_SIZES[id][page.orientation]}
              onClick={() => onSize(id)}
              className={tileClass(current === id)}
            >
              <SizeGlyph size={id} page={page} />
              {SIZE_TILE[id].label}
            </button>
          </Tooltip>
        ))}
      </div>
    </PanelSection>
  );
}

export function OrientationSection({
  page,
  onOrientation,
}: {
  page: Page;
  onOrientation: (o: PageOrientation) => void;
}) {
  if (!pageHasOrientation(page)) return null;
  return (
    <PanelSection title="Orientation">
      <div
        role="radiogroup"
        aria-label="Orientation"
        className={`relative grid grid-cols-2 rounded-lg p-0.5 ${SEGMENT_TRACK}`}
      >
        <SegmentSlider
          count={2}
          index={page.orientation === 'portrait' ? 0 : 1}
          className={ACTIVE_SEGMENT}
        />
        {(['portrait', 'landscape'] as const).map((o) => {
          const on = page.orientation === o;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onOrientation(o)}
              className={`relative z-10 flex items-center justify-center gap-1.5 rounded-md py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
                on
                  ? 'text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Glyph size={14} units={16}>
                <rect
                  x={o === 'portrait' ? 4 : 1.5}
                  y={o === 'portrait' ? 1.5 : 4}
                  width={o === 'portrait' ? 8 : 13}
                  height={o === 'portrait' ? 13 : 8}
                  rx={1.2}
                />
              </Glyph>
              {o === 'portrait' ? 'Portrait' : 'Landscape'}
            </button>
          );
        })}
      </div>
    </PanelSection>
  );
}

// One round swatch. The paper swatch is drawn as the paper (white, or slate in dark chrome).
