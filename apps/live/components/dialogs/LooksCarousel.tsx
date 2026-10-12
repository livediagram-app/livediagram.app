'use client';

// The Looks carousel on the Tab Style home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the looks
// in pages of six (PagedCarousel), opening on the page that holds the tab's current look. Each card is a live preview
// drawn by the exporter.

import { useMemo } from 'react';
import { PagedCarousel } from '@/components/primitives/PagedCarousel';
import { lookPreviewSvg, lookPreviewTab } from '@/lib/look-preview';
import { LOOKS_PER_PAGE, TAB_LOOKS, type TabLook, type TabLookId } from '@/lib/tab-looks';

export function LooksCarousel({
  activeLook,
  onPickLook,
  headingClass,
}: {
  activeLook: TabLookId | undefined;
  onPickLook: (id: TabLookId) => void;
  headingClass: string;
}) {
  // Each card's preview is fixed for its look, so it is drawn once per open.
  const previews = useMemo(
    () =>
      new Map(
        TAB_LOOKS.map((look) => [
          look.id,
          { markup: lookPreviewSvg(look), paper: lookPreviewTab(look).backgroundColor },
        ]),
      ),
    [],
  );
  return (
    <section aria-labelledby="looks-heading">
      <PagedCarousel
        items={TAB_LOOKS}
        perPage={LOOKS_PER_PAGE}
        label="Looks"
        heading={
          <h3 id="looks-heading" className={headingClass}>
            Looks
          </h3>
        }
        gridClass="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        // Open on the page holding the current look (the first when the tab has its own mix).
        initialIndex={TAB_LOOKS.findIndex((l) => l.id === activeLook)}
        renderItem={(look) => (
          <LookCard
            key={look.id}
            look={look}
            active={activeLook === look.id}
            markup={previews.get(look.id)!.markup}
            paper={previews.get(look.id)!.paper}
            onPick={() => onPickLook(look.id)}
          />
        )}
      />
    </section>
  );
}

function LookCard({
  look,
  active,
  markup,
  paper,
  onPick,
}: {
  look: TabLook;
  active: boolean;
  markup: string;
  paper: string | undefined;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      className={`flex flex-col overflow-hidden rounded-lg text-left transition ${
        active
          ? 'border-2 border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
          : 'border border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60'
      }`}
    >
      <span
        aria-hidden
        className="block h-20 w-full overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ backgroundColor: paper }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <span className="flex flex-col gap-0.5 px-2.5 pb-2.5 pt-2">
        <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
          {look.label}
        </span>
        <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
          {look.description}
        </span>
      </span>
    </button>
  );
}
