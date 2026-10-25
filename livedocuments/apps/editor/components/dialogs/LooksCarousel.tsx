'use client';

// The Looks carousel on the Tab Style home (docs/specs/011-theme/canvas-and-theme-dialog.md "Looks"): the looks
// in pages of six (PagedCarousel), led by the Mashup card ("Mashup": a random look, rolled afresh on each press),
// opening on the page that holds the tab's current look, with a Seasonal toggle and a Finish filter left of the page
// controls. The toggle swaps the everyday looks for the seasonal ones ("Seasonal looks", lib/seasonal-looks.ts). Each
// card is a live preview drawn by the exporter.

import { useMemo, useState, type ReactNode } from 'react';
import { FINISHES, type Finish } from '@livedocuments/document';
import { Select, lucideGlyph, trustedHtml } from '@livedocuments/ui';
import { lucideDices } from '@liveworkspace/icons/lucide';
import { FINISH_LABELS } from '@/components/palette/FinishSection';
import { track } from '@/lib/telemetry';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';
import { lookPreviewSvg, lookPreviewTab } from '@/lib/look-preview';
import { rollMashup } from '@/lib/look-mashup';
import { SEASON_LABELS, seasonalLooksFor } from '@/lib/seasonal-looks';
import {
  LOOKS_PER_PAGE,
  TAB_LOOKS,
  lookMatches,
  type LookSettings,
  type TabLook,
  type TabLookId,
} from '@/lib/tab-looks';

const DiceIcon = lucideGlyph(lucideDices, 14);

// The Mashup card leads every page set; the looks follow.
type Card = { kind: 'mashup' } | TabLook;
const MASHUP_CARD: Card = { kind: 'mashup' };

// The Seasonal toggle: a quiet chip beside the Finish filter, brand-tinted while on.
const SEASONAL_TOGGLE =
  'cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300';
const SEASONAL_OFF =
  'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700';
const SEASONAL_ON =
  'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-200';

export function LooksCarousel({
  settings,
  activeLook,
  onPickLook,
  headingClass,
}: {
  // The tab's four look settings, to tell whether it wears the Mashup card's look.
  settings: LookSettings;
  activeLook: TabLookId | undefined;
  // A named look's id, or the Mashup card's random look whole.
  onPickLook: (look: TabLookId | TabLook) => void;
  headingClass: string;
}) {
  // Each look's preview is fixed for an appearance, so they are drawn once per open (again if the viewer's mode
  // changes: they draw in its half).
  const { appearance } = useAppearance();
  // The finish the looks are narrowed to, or all of them.
  const [finish, setFinish] = useState<Finish | 'all'>('all');
  // The seasonal looks for today, the season on now (or next) first; worked out once per open.
  const [seasonalLooks] = useState(() => seasonalLooksFor(new Date()));
  // Seasonal looks only, in place of the everyday ones. Opens on when the tab already wears a seasonal look.
  const [seasonal, setSeasonal] = useState(() => seasonalLooks.some((l) => l.id === activeLook));
  const pool = seasonal ? seasonalLooks : TAB_LOOKS;
  const looks = finish === 'all' ? pool : pool.filter((l) => l.finish === finish);
  // The Mashup card rolls everyday ingredients, so it leads the everyday looks only.
  const cards: Card[] = seasonal ? [...looks] : [MASHUP_CARD, ...looks];
  // The card's mashup: rolled on open, not applied until pressed, so the first press applies what the card shows.
  const [mashup, setMashup] = useState(() => rollMashup());
  const wearingMashup = lookMatches(settings, mashup);
  const pickMashup = () => {
    // While the tab wears the card's mashup, a press rolls the next one; otherwise it applies the one on show.
    const next = wearingMashup
      ? rollMashup({ finish: finish === 'all' ? undefined : finish, previous: mashup })
      : mashup;
    setMashup(next);
    onPickLook(next);
  };
  const mashupPreview = useMemo(
    () => ({ markup: lookPreviewSvg(mashup), paper: lookPreviewTab(mashup).backgroundColor }),
    // As the looks' previews: redrawn in the viewer's half when it changes.
    // oxlint-disable-next-line react/exhaustive-deps
    [mashup, appearance],
  );
  const previews = useMemo(
    () =>
      new Map(
        [...TAB_LOOKS, ...seasonalLooks].map((look) => [
          look.id,
          { markup: lookPreviewSvg(look), paper: lookPreviewTab(look).backgroundColor },
        ]),
      ),
    // The previews read the viewer's appearance themselves (getTheme); it is a dependency so they redraw on a change.
    // oxlint-disable-next-line react/exhaustive-deps
    [appearance],
  );
  return (
    <section aria-labelledby="looks-heading" data-tour-id="tab-style-looks">
      <PagedCarousel
        // A new filter starts its own pages.
        key={`${seasonal ? 'seasonal' : 'everyday'}:${finish}`}
        items={cards}
        perPage={LOOKS_PER_PAGE}
        label="Looks"
        navTourId="tab-style-looks-nav"
        heading={
          <h3 id="looks-heading" className={headingClass}>
            Looks
          </h3>
        }
        gridClass="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
        // Open on the page holding the tab's look (the first page when it has its own mix).
        initialIndex={cards.findIndex((c) => 'id' in c && c.id === activeLook)}
        controls={
          <>
            <button
              type="button"
              aria-pressed={seasonal}
              onClick={() => {
                track('UI', 'Changed', 'LooksSeasonal');
                setSeasonal(!seasonal);
              }}
              className={`${SEASONAL_TOGGLE} ${seasonal ? SEASONAL_ON : SEASONAL_OFF}`}
            >
              Seasonal
            </button>
            <Select
              size="sm"
              variant="ghost"
              aria-label="Filter looks by finish"
              value={finish}
              onChange={(e) => {
                const next = e.target.value as Finish | 'all';
                track('UI', 'Changed', 'LooksFinishFilter');
                setFinish(next);
                // The card's mashup rolls within the chosen finish.
                if (next !== 'all' && mashup.finish !== next)
                  setMashup(rollMashup({ finish: next }));
              }}
            >
              <option value="all">All finishes</option>
              {FINISHES.map((f) => (
                <option key={f} value={f}>
                  {FINISH_LABELS[f]}
                </option>
              ))}
            </Select>
          </>
        }
        renderItem={(look) => {
          if (!('id' in look))
            return (
              <LookCard
                key="mashup"
                look={mashup}
                active={wearingMashup}
                markup={mashupPreview.markup}
                paper={mashupPreview.paper}
                onPick={pickMashup}
                ariaLabel="Mashup: a random look, press for another"
                badge={<DiceIcon />}
              />
            );
          const preview = previews.get(look.id)!;
          return (
            <LookCard
              key={look.id}
              look={look}
              active={activeLook === look.id}
              markup={preview.markup}
              paper={preview.paper}
              onPick={() => onPickLook(look.id)}
              eyebrow={look.season ? SEASON_LABELS[look.season] : undefined}
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
  ariaLabel,
  badge,
  eyebrow,
}: {
  look: TabLook;
  active: boolean;
  markup: string;
  paper: string | undefined;
  onPick: () => void;
  ariaLabel?: string;
  // A glyph pinned to the preview's corner (the Mashup card's dice).
  badge?: ReactNode;
  // A seasonal look's season, above its name.
  eyebrow?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onPick}
      className={`relative flex flex-col overflow-hidden rounded-lg text-left transition ${
        active
          ? 'border-2 border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15'
          : 'border border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500/60'
      }`}
    >
      <span
        aria-hidden
        className="block h-20 w-full overflow-hidden [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
        style={{ backgroundColor: paper }}
        dangerouslySetInnerHTML={{ __html: trustedHtml(markup) }}
      />
      {badge ? (
        <span
          aria-hidden
          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-slate-700 shadow-sm dark:bg-slate-900/85 dark:text-slate-200"
        >
          {badge}
        </span>
      ) : null}
      <span className="flex flex-col gap-0.5 px-2.5 pb-2.5 pt-2">
        {eyebrow ? (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            {eyebrow}
          </span>
        ) : null}
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
