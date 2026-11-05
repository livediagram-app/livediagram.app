'use client';

// A carousel of floors (the Tab Style Canvas panel, docs/specs/011-theme/canvas-and-theme-dialog.md "Canvas panel"):
// each floor drawn for real, in the half the tab's canvas colour is in, its name beneath, nine to a page (six on a
// phone, so the tiles stay big without a long scroll). Drawn a little smaller than on the canvas, so a tile shows
// enough of its floor to read (a few planks, a run of cobbles).

import type { CSSProperties } from 'react';
import { HoverCard, useMediaQuery } from '@livehuddle/ui';
import type { BackgroundPattern, SpacePattern } from '@livehuddle/document';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';
import type { PatternEntry } from '@/components/palette/palette-controls';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';

const headingClass = 'text-[10px] font-medium text-slate-500 dark:text-slate-300';
const PREVIEW_SCALE = 0.6;

export function PatternCarousel({
  heading,
  patterns,
  active,
  onPick,
  backgroundColor,
  patternColor,
}: {
  heading: string;
  patterns: readonly PatternEntry[];
  active: SpacePattern;
  onPick: (pattern: BackgroundPattern) => void;
  backgroundColor: string;
  patternColor: string;
}) {
  const wide = useMediaQuery('(min-width: 640px)');
  return (
    <PagedCarousel
      items={patterns}
      perPage={wide ? 9 : 6}
      label={`${heading} choices`}
      heading={<p className={headingClass}>{heading}</p>}
      gridClass="grid grid-cols-3 gap-2"
      initialIndex={patterns.findIndex((p) => p.id === active)}
      renderItem={(p) => (
        <HoverCard key={p.id} title={p.label} description={p.description}>
          <PatternPreviewTile
            active={active === p.id}
            label={p.shortLabel}
            onClick={() => onPick(p.id)}
            style={tabBackgroundStyle(
              p.id,
              { x: 0, y: 0 },
              backgroundColor,
              patternColor,
              1,
              PREVIEW_SCALE,
            )}
          />
        </HoverCard>
      )}
    />
  );
}

// One floor: drawn for real on the tab's canvas colour, its name beneath.
function PatternPreviewTile({
  active,
  label,
  onClick,
  style,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  style: CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`flex w-full cursor-pointer flex-col gap-1 rounded-lg p-1 text-left transition ${
        active
          ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500 dark:bg-brand-500/20 dark:text-brand-200 dark:ring-brand-400'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
      }`}
    >
      <span
        aria-hidden
        className="flex h-16 w-full items-center justify-center rounded-md border border-slate-200 dark:border-slate-700"
        style={style}
      />
      <span className="w-full truncate px-0.5 text-center text-[11px] font-medium">{label}</span>
    </button>
  );
}
