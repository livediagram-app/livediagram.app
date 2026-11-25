'use client';

// The Page Design panel's catalogue (docs/specs/011-theme/canvas-and-theme-dialog.md "Page Design"): None, then each
// family under its heading as tiles of a small page in the tab's theme, with a chip row that jumps to a family. The
// design worn is selected; a press applies it.
import { useMemo, useRef } from 'react';
import {
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

const TILE =
  'group relative flex cursor-pointer flex-col gap-1 rounded-lg p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500';
const FRAME =
  'relative aspect-[16/10] w-full overflow-hidden rounded-md ring-1 ring-slate-200 transition-shadow group-hover:ring-slate-300 dark:ring-slate-700 dark:group-hover:ring-slate-500';
const SELECTED = 'ring-2 ring-brand-500 group-hover:ring-brand-500 dark:ring-brand-400';

export function DesignGrid({
  look,
  worn,
  noneLabel,
  onPick,
}: {
  look: TileLook;
  worn: PageDesignId | 'none';
  // "None" on the tab, "No Design" on a page (it draws none even while the tab has one).
  noneLabel: string;
  onPick: (id: PageDesignId | 'none') => void;
}) {
  const families = useRef<Record<string, HTMLElement | null>>({});
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
  return (
    <div className="flex flex-col gap-3" data-page-design-grid="">
      <div className="flex flex-wrap gap-1" role="group" aria-label="Jump to a family">
        {PAGE_DESIGN_FAMILIES.map((f) => (
          <button
            key={f.id}
            type="button"
            className="cursor-pointer rounded-full border border-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
            onClick={() =>
              families.current[f.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <span className="text-optical-line">{f.label}</span>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <button
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
      </div>
      {PAGE_DESIGN_FAMILIES.map((f) => (
        <section
          key={f.id}
          ref={(el) => {
            families.current[f.id] = el;
          }}
          aria-label={f.label}
          className="scroll-mt-14"
        >
          <h4 className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {f.label}
          </h4>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {designsOfFamily(f.id).map((d) => (
              <button
                key={d.id}
                type="button"
                className={TILE}
                aria-pressed={worn === d.id}
                aria-label={d.label}
                onClick={() => onPick(d.id)}
                data-page-design-tile={d.id}
              >
                <span className={`${FRAME} ${worn === d.id ? SELECTED : ''}`}>
                  <DesignTileImage input={inputs[d.id]!} />
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
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
