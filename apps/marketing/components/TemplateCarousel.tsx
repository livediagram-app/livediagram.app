'use client';

import type { ReactNode } from 'react';
import { BAND_LABEL } from '@/components/band-classes';
import { SnapCarousel } from '@livediagram/ui';

// One category's row of the template gallery (docs/specs/019-marketing/marketing-site.md): the shared
// SnapCarousel (the editor's template picker browses a category with the same
// one) showing four cards across on desktop, two on a tablet and one on a
// phone, under the band's own heading style.
export function TemplateCarousel({
  label,
  count,
  itemsKey,
  reveal = false,
  children,
}: {
  label: string;
  // How many cards the row holds, shown as a badge beside the heading on a
  // phone, where one card per page hides how far the row goes.
  count: number;
  // Changes when the row's cards change (a filter), so the track rewinds
  // rather than staying scrolled past cards that are no longer there.
  itemsKey: string;
  // Rise into place on mount (a category the visitor just opened, or one a
  // search revealed); the category open on page load sits still.
  reveal?: boolean;
  children: ReactNode;
}) {
  return (
    <SnapCarousel
      className={reveal ? 'tg-reveal' : undefined}
      label={label}
      itemsKey={itemsKey}
      heading={
        <>
          <h3 className={BAND_LABEL}>{label}</h3>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600 sm:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {count}
            <span className="sr-only"> templates</span>
          </span>
        </>
      }
      // Each card is a snap point sized to a quarter / half / all of the
      // track less the gaps, so a page is always whole cards. A category
      // with fewer cards than a page grows them to fill the row, so its
      // edges line up with the band (a lone search hit stops at half).
      trackClassName="tg-reveal-track mt-3"
      itemClassName="[&>li]:basis-full sm:[&>li]:max-w-[calc((100%-0.75rem)/2)] sm:[&>li]:basis-[calc((100%-0.75rem)/2)] lg:[&>li]:basis-[calc((100%-2.25rem)/4)]"
    >
      {children}
    </SnapCarousel>
  );
}
