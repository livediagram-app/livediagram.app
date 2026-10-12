'use client';

// The Looks carousel on the Tab Style home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the looks
// in pages of six (PagedCarousel), opening on the page that holds the tab's current look. Each card is a live preview
// drawn by the exporter.

import { useMemo } from 'react';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { PagedCarousel } from '@/components/primitives/PagedCarousel';
import { lookPreviewSvg, lookPreviewTab } from '@/lib/look-preview';
import {
  LOOKS_PER_PAGE,
  TAB_LOOKS,
  withLookApplied,
  type LookLike,
  type TabLookId,
} from '@/lib/tab-looks';
import { usePreviewHover } from './TabStylePreviewContext';

export function LooksCarousel({
  activeLook,
  current,
  onPickLook,
  headingClass,
}: {
  activeLook: TabLookId | undefined;
  // The tab's own mix, shown first and selected when it matches no look; omitted when a look matches.
  current?: LookLike;
  onPickLook: (id: TabLookId) => void;
  headingClass: string;
}) {
  // Each look's preview is fixed for an appearance, so the twelve are drawn once per open (again if the viewer's mode
  // changes: they draw in its half); the Current card redraws with the tab.
  const { appearance } = useAppearance();
  const previews = useMemo(
    () =>
      new Map(
        TAB_LOOKS.map((look) => [
          look.id,
          { markup: lookPreviewSvg(look), paper: lookPreviewTab(look).backgroundColor },
        ]),
      ),
    // The previews read the viewer's appearance themselves (getTheme); it is a dependency so they redraw on a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appearance],
  );
  const currentPreview = useMemo(
    () =>
      current
        ? { markup: lookPreviewSvg(current), paper: lookPreviewTab(current).backgroundColor }
        : null,
    // The mix's fields, so a new object with the same settings keeps the drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      current?.theme,
      current?.finish,
      current?.font,
      current?.pattern,
      current?.patternOpacity,
      appearance,
    ],
  );
  const items: readonly LookLike[] = current ? [current, ...TAB_LOOKS] : TAB_LOOKS;
  return (
    <section aria-labelledby="looks-heading" data-tour-id="tab-style-looks">
      <PagedCarousel
        items={items}
        perPage={LOOKS_PER_PAGE}
        label="Looks"
        navTourId="tab-style-looks-nav"
        heading={
          <h3 id="looks-heading" className={headingClass}>
            Looks
          </h3>
        }
        gridClass="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        // Open on the page holding the current look (the first, with Current, when the tab has its own mix).
        initialIndex={items.findIndex((l) => l.id === (activeLook ?? 'current'))}
        renderItem={(look) => {
          const isCurrent = look.id === 'current';
          const preview = isCurrent ? currentPreview! : previews.get(look.id as TabLookId)!;
          return (
            <LookCard
              key={look.id}
              look={look}
              active={isCurrent || activeLook === look.id}
              markup={preview.markup}
              paper={preview.paper}
              // The tab's own mix is already applied: picking it changes nothing.
              onPick={isCurrent ? () => {} : () => onPickLook(look.id as TabLookId)}
            />
          );
        }}
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
  look: LookLike;
  active: boolean;
  markup: string;
  paper: string | undefined;
  onPick: () => void;
}) {
  // Hover draws the tab in this look (the Current card is the tab already).
  const previewHover = usePreviewHover((t) =>
    look.id === 'current' ? t : withLookApplied(t, look),
  );
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPick}
      {...previewHover}
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
