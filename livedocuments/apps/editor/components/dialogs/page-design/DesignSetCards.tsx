'use client';

// Design Sets (docs/specs/011-theme/page-designs.md "Design sets"): each set as a card, a small page in its own theme,
// background and design with its name and line; one press applies the whole set as one undo step.
import { useMemo } from 'react';
import { PAGE_DESIGN_SETS, designSetBackground } from '@livedocuments/document';
import { getTheme } from '@/lib/themes';
import { DesignTileImage } from './DesignTile';
import type { DesignTileInput } from './design-tile-svg';

export function DesignSetCards({ onApply }: { onApply: (setId: string) => void }) {
  const inputs = useMemo(
    () =>
      PAGE_DESIGN_SETS.map((set): DesignTileInput => {
        const theme = getTheme(set.theme, 'light');
        const background = designSetBackground(set, theme);
        return {
          design: set.design,
          theme,
          paperDark: false,
          ...(background ? { background } : {}),
          font: set.font,
          idPrefix: `pds-${set.id}-`,
        };
      }),
    [],
  );
  return (
    <div className="grid grid-cols-2 gap-2" data-page-design-sets="">
      {PAGE_DESIGN_SETS.map((set, i) => (
        <button
          key={set.id}
          type="button"
          onClick={() => onApply(set.id)}
          className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition-[border-color,box-shadow] hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500"
          data-page-design-set={set.id}
        >
          <span className="aspect-[16/9] w-full overflow-hidden">
            <DesignTileImage
              input={inputs[i]!}
              className="transition-transform duration-150 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          </span>
          <span className="flex flex-col gap-0.5 px-2 py-1.5">
            <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100">
              {set.label}
            </span>
            <span className="line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400">
              {set.blurb}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
