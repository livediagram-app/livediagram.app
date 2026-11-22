'use client';

// The Looks carousel on the Tab Style home (liveworkspace/docs/specs/011-workbench/tab-style.md "What is shared"; each
// product's 011-theme/canvas-and-theme-dialog.md "Looks", "Mashup", "Seasonal looks"): the looks in pages of six
// (PagedCarousel), led by the Mashup card (a random look, rolled afresh on each press), opening on the page that holds
// the tab's current look, with a Seasonal toggle and a Finish filter left of the page controls. The toggle swaps the
// everyday looks for the seasonal ones. Each card is a live preview drawn by the product's renderer.

import { useMemo, useState, type ReactNode } from 'react';
import { FINISHES, type Finish } from '@liveworkspace/element-model/finish';
import { resolveFontStack } from '@liveworkspace/model-core/fonts';
import { Select, lucideGlyph } from '@liveworkspace/ui';
import { builtMarkup, htmlProps } from '@liveworkspace/trusted-types';
import { lucideDices } from '@liveworkspace/icons/lucide';
import { workbench } from '../../../bindings';
import { PagedCarousel } from '../../primitives/PagedCarousel';
import { LOOKS_PER_PAGE, type TabLookSettings } from '../../../lib/tab-looks';
import { SEASON_LABELS } from '../../../lib/seasonal-looks';
import type { TabStyleLook, TabStyleProfile } from './tab-style-profile';

const DiceIcon = lucideGlyph(lucideDices, 14);

// The Mashup card leads every page set; the looks follow.
type Card<Look> = { kind: 'mashup' } | Look;
const MASHUP_CARD = { kind: 'mashup' } as const;

// The Seasonal toggle: a quiet chip beside the Finish filter, brand-tinted while on.
const SEASONAL_TOGGLE =
  'cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300';
const SEASONAL_OFF =
  'border-transparent text-slate-600 hover:border-slate-200 hover:bg-white dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700';
const SEASONAL_ON =
  'border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-200';

export function LooksCarousel<Look extends TabStyleLook, Pattern extends string>({
  profile,
  lookFilter,
  settings,
  activeLook,
  onPickLook,
  headingClass,
}: {
  profile: Pick<
    TabStyleProfile<Look, Pattern>,
    'looks' | 'finishLabels' | 'useAppearance' | 'finishFilter'
  >;
  // The surface's filter over the catalogue; every look when unset.
  lookFilter?: (look: Look) => boolean;
  // The tab's four look settings, to tell whether it wears the Mashup card's look.
  settings: TabLookSettings;
  activeLook: string | undefined;
  // A named look's id, or the Mashup card's random look whole.
  onPickLook: (look: string | Look) => void;
  headingClass: string;
}) {
  const { looks: catalogue, finishLabels } = profile;
  // Each look's preview is fixed for an appearance, so it is drawn once per open (again if the viewer's mode
  // changes: they draw in its half).
  const appearance = profile.useAppearance();
  // The finish the looks are narrowed to, or all of them.
  const [finish, setFinish] = useState<Finish | 'all'>('all');
  // The seasonal looks for today, the season on now (or next) first; worked out once per open.
  const [seasonalLooks] = useState(() => catalogue.seasonalFor(new Date()));
  // Seasonal looks only, in place of the everyday ones. Opens on when the tab already wears a seasonal look.
  const [seasonal, setSeasonal] = useState(() => seasonalLooks.some((l) => l.id === activeLook));
  const pool = (seasonal ? seasonalLooks : catalogue.all).filter(
    (l) => !lookFilter || lookFilter(l),
  );
  const looks = finish === 'all' ? pool : pool.filter((l) => l.finish === finish);
  // The finishes this surface's looks wear: the filter offers only those. When the surface's filter keeps a finish out
  // (a logo page keeps hand-drawn looks out), the Mashup card rolls within the ones left, never a Marker mashup there.
  const finishes = FINISHES.filter((f) => pool.some((l) => l.finish === f));
  const narrowed = FINISHES.some(
    (f) => !finishes.includes(f) && catalogue.all.some((l) => l.finish === f),
  );
  const roll = (options: { finish?: Finish; previous?: Look }) =>
    catalogue.rollMashup(
      options.finish || !narrowed
        ? options
        : { ...options, finish: finishes[Math.floor(Math.random() * finishes.length)] },
    );
  // The Mashup card rolls everyday ingredients, so it leads the everyday looks only.
  const cards: Card<Look>[] = seasonal ? [...looks] : [MASHUP_CARD, ...looks];
  // The card's mashup: rolled on open, not applied until pressed, so the first press applies what the card shows.
  const [mashup, setMashup] = useState(() => roll({}));
  const wearingMashup = catalogue.matches(settings, mashup);
  const pickMashup = () => {
    // While the tab wears the card's mashup, a press rolls the next one; otherwise it applies the one on show.
    const next = wearingMashup
      ? roll({ finish: finish === 'all' ? undefined : finish, previous: mashup })
      : mashup;
    setMashup(next);
    onPickLook(next);
  };
  const mashupPreview = useMemo(
    () => catalogue.preview(mashup),
    // oxlint-disable-next-line react/exhaustive-deps -- as the looks' previews: redrawn in the viewer's half when it changes
    [mashup, appearance],
  );
  // Drawn when a card first mounts (the page on show and its neighbours), not all at once on open: every look's
  // preview is a full export, and drawing them all up front was what a loaded machine's first render choked on.
  const previewOf = useMemo(() => {
    const drawn = new Map<string, { markup: string; paper: string | undefined }>();
    return (look: Look) => {
      let preview = drawn.get(look.id);
      if (!preview) {
        preview = catalogue.preview(look);
        drawn.set(look.id, preview);
      }
      return preview;
    };
    // oxlint-disable-next-line react/exhaustive-deps -- the previews read the viewer's appearance themselves; it is a dependency so they redraw on a change
  }, [appearance]);
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
                workbench.track('UI', 'Changed', 'LooksSeasonal');
                setSeasonal(!seasonal);
              }}
              className={`${SEASONAL_TOGGLE} ${seasonal ? SEASONAL_ON : SEASONAL_OFF}`}
            >
              Seasonal
            </button>
            {profile.finishFilter === false ? null : (
              <Select
                size="sm"
                variant="ghost"
                className="shrink-0"
                aria-label="Filter looks by finish"
                value={finish}
                onChange={(e) => {
                  const next = e.target.value as Finish | 'all';
                  workbench.track('UI', 'Changed', 'LooksFinishFilter');
                  setFinish(next);
                  // The card's mashup rolls within the chosen finish.
                  if (next !== 'all' && mashup.finish !== next) setMashup(roll({ finish: next }));
                }}
              >
                <option value="all">All finishes</option>
                {finishes.map((f) => (
                  <option key={f} value={f}>
                    {finishLabels[f]}
                  </option>
                ))}
              </Select>
            )}
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
          const preview = previewOf(look);
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
  look: TabStyleLook;
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
        {...htmlProps(builtMarkup(markup))}
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
        {/* The name in the look's own typeface (the app's for a look that names none). */}
        <span
          className="text-[13px] font-semibold text-slate-800 dark:text-slate-100"
          style={{ fontFamily: resolveFontStack(look.font) }}
        >
          {look.label}
        </span>
        {/* slate-600: slate-500 read 4.46:1 on the picked card's brand-50 tint, under AA for 11px text. */}
        <span className="text-[11px] leading-snug text-slate-600 dark:text-slate-300">
          {look.description}
        </span>
      </span>
    </button>
  );
}
