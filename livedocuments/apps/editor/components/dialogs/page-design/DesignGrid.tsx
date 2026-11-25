'use client';

// The Page Design panel's catalogue (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): a chip row (All,
// then each family) over one carousel of tiles, six at a time, each a small page in the tab's theme. All holds None,
// then every family's. The design worn is selected, and the carousel opens on its page; a press applies it.
import { useMemo, useState, type ReactNode } from 'react';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';
import {
  PAGE_DESIGN_BY_ID,
  PAGE_DESIGN_FAMILIES,
  designsOfFamily,
  type DesignTheme,
  type PageBackground,
  type PageDesignId,
} from '@livedocuments/document';
import { DesignTileImage } from './DesignTile';
import type { DesignTileInput } from './design-tile-svg';

export type TileLook = {
  theme: DesignTheme;
  paperDark: boolean;
  background: PageBackground | undefined;
  font: string | undefined;
};

export const TILE =
  'group relative flex cursor-pointer flex-col gap-1 rounded-lg p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500';
export const FRAME =
  'relative aspect-[16/10] w-full overflow-hidden rounded-md ring-1 ring-slate-200 transition-shadow group-hover:ring-slate-300 dark:ring-slate-700 dark:group-hover:ring-slate-500';
export const SELECTED = 'ring-2 ring-brand-500 group-hover:ring-brand-500 dark:ring-brand-400';

export function DesignGrid({
  look,
  worn,
  noneLabel,
  onPick,
  moving,
}: {
  look: TileLook;
  worn: PageDesignId | 'none';
  // "None" on the tab, "No Design" on a page (it draws none even while the tab has one).
  noneLabel: string;
  onPick: (id: PageDesignId | 'none') => void;
  // The Moving chip's body (the animated backgrounds, on a slide or a flashcard), and whether to open on it (the
  // page's background moves now). Absent, no Moving chip.
  moving?: { body: ReactNode; open: boolean };
}) {
  const inputs = useMemo(() => {
    const out: Partial<Record<PageDesignId, DesignTileInput>> = {};
    for (const f of PAGE_DESIGN_FAMILIES)
      for (const d of designsOfFamily(f.id))
        out[d.id] = {
          design: { id: d.id },
          theme: look.theme,
          paperDark: look.paperDark,
          background: look.background,
          font: look.font,
          idPrefix: `pdt-${d.id}-`,
        };
    return out;
  }, [look]);
  const noneTile = (
    <button
      key="none"
      type="button"
      className={TILE}
      aria-pressed={worn === 'none'}
      onClick={() => onPick('none')}
      data-page-design-tile="none"
    >
      <span
        className={`${FRAME} flex items-center justify-center bg-white dark:bg-slate-900 ${worn === 'none' ? SELECTED : ''}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-slate-300 dark:text-slate-600"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M6.5 17.5l11-11" />
        </svg>
      </span>
      <span className="truncate px-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
        {noneLabel}
      </span>
    </button>
  );
  const tile = (id: PageDesignId) => {
    const d = PAGE_DESIGN_BY_ID[id];
    return (
      <button
        key={id}
        type="button"
        className={TILE}
        aria-pressed={worn === id}
        aria-label={d.label}
        onClick={() => onPick(id)}
        data-page-design-tile={id}
      >
        <span className={`${FRAME} ${worn === id ? SELECTED : ''}`}>
          <DesignTileImage input={inputs[id]!} />
          {d.animates ? (
            <span
              aria-hidden="true"
              className="absolute bottom-1 right-1 rounded-full bg-black/45 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white"
            >
              <span className="text-optical-line">Moves</span>
            </span>
          ) : null}
        </span>
        <span className="truncate px-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
          {d.label}
        </span>
      </button>
    );
  };
  // One carousel at a time: All (None, then every family's) or one family, picked from the chips (owner, 2026-11-25),
  // so the screen stays one height however many families there are.
  const [family, setFamily] = useState<string>(moving?.open ? 'moving' : 'all');
  const items: (PageDesignId | 'none')[] = useMemo(
    () =>
      family === 'moving'
        ? []
        : family === 'all'
          ? ['none', ...PAGE_DESIGN_FAMILIES.flatMap((f) => designsOfFamily(f.id).map((d) => d.id))]
          : designsOfFamily(family as Parameters<typeof designsOfFamily>[0]).map((d) => d.id),
    [family],
  );
  // All first, then the families, Gradients and Moving last (owner, 2026-11-25).
  const chips = [
    { id: 'all', label: 'All' },
    ...PAGE_DESIGN_FAMILIES.filter((f) => f.id !== 'gradients'),
    ...PAGE_DESIGN_FAMILIES.filter((f) => f.id === 'gradients'),
    ...(moving ? [{ id: 'moving', label: 'Moving' }] : []),
  ];
  const heading = chips.find((c) => c.id === family)?.label ?? 'All';
  return (
    <div className="flex flex-col gap-2" data-page-design-grid="">
      {/* The families as chips on a soft track, wrapping onto more lines so every one is in reach (no sideways
          scroll), each with a small picture of its first design (All a grid, Moving a wave), the one up raised white. */}
      <div className="relative -mx-1">
        <div
          className="flex flex-wrap gap-x-1.5 gap-y-2 rounded-xl bg-slate-100 p-2 dark:bg-slate-800/70"
          role="group"
          aria-label="Design families"
        >
          {chips.map((c) => {
            const on = family === c.id;
            const first =
              c.id === 'all' || c.id === 'moving'
                ? undefined
                : designsOfFamily(c.id as Parameters<typeof designsOfFamily>[0])[0]?.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFamily(c.id)}
                data-page-design-family={c.id}
                className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
                  on
                    ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-950 dark:text-white dark:ring-white/10'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60 dark:hover:text-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`relative flex aspect-[16/10] w-6 shrink-0 items-center justify-center overflow-hidden rounded-[4px] ring-1 transition-colors ${
                    on ? 'ring-brand-500/70' : 'ring-slate-900/10 dark:ring-white/15'
                  } ${first ? '' : 'bg-white text-slate-400 dark:bg-slate-900 dark:text-slate-400'}`}
                >
                  {first ? (
                    <DesignTileImage input={{ ...inputs[first]!, idPrefix: `pdc-${first}-` }} />
                  ) : c.id === 'all' ? (
                    <svg viewBox="0 0 16 10" className="h-2.5 w-4" fill="currentColor">
                      <rect x="1" y="1" width="6" height="3.5" rx="0.8" />
                      <rect x="9" y="1" width="6" height="3.5" rx="0.8" />
                      <rect x="1" y="5.5" width="6" height="3.5" rx="0.8" />
                      <rect x="9" y="5.5" width="6" height="3.5" rx="0.8" />
                    </svg>
                  ) : (
                    <svg
                      viewBox="0 0 16 10"
                      className="h-2.5 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.4}
                      strokeLinecap="round"
                    >
                      <path d="M1 4c2-2.5 4 2.5 7 0s5-2.5 7 0" />
                      <path d="M1 7.5c2-2.5 4 2.5 7 0s5-2.5 7 0" opacity={0.5} />
                    </svg>
                  )}
                </span>
                <span className="text-optical-line whitespace-nowrap">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {family === 'moving' && moving ? (
        moving.body
      ) : (
        <PagedCarousel
          // A new family starts on its own first page (or the one holding the design worn).
          key={family}
          items={items}
          perPage={6}
          label={`${heading} designs`}
          heading={
            <h4 className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {heading}
            </h4>
          }
          gridClass="grid grid-cols-3 gap-1.5"
          initialIndex={items.indexOf(worn)}
          renderItem={(id) => (id === 'none' ? noneTile : tile(id))}
        />
      )}
    </div>
  );
}
