'use client';

// A carousel of canvas patterns (the Tab Style Canvas panel, docs/specs/011-theme/canvas-and-theme-dialog.md
// "Canvas panel"): each pattern drawn for real on the tab's canvas colour, its name beneath, nine to a page (six on a
// phone, so the tiles stay big without a long scroll). Animated patterns cannot be stilled into a tile, so theirs show
// the pattern's glyph on the canvas colour.

import type { CSSProperties, ReactNode } from 'react';
import { HoverCard, useMediaQuery } from '@liveplanner/ui';
import type { BackgroundPattern } from '@liveplanner/project';
import { PagedCarousel } from '@liveworkspace/workbench/components/primitives/PagedCarousel';
import type { PatternEntry } from '@/components/palette/palette-controls';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';

const headingClass = 'text-[10px] font-medium text-slate-500 dark:text-slate-300';

export function PatternCarousel({
  heading,
  patterns,
  animated = false,
  active,
  onPick,
  backgroundColor,
  patternColor,
}: {
  heading: string;
  patterns: readonly PatternEntry[];
  animated?: boolean;
  active: BackgroundPattern;
  onPick: (pattern: BackgroundPattern) => void;
  backgroundColor: string;
  patternColor: string;
}) {
  const wide = useMediaQuery('(min-width: 640px)');
  return (
    <PagedCarousel
      items={patterns}
      perPage={wide ? 9 : 6}
      label={`${heading} patterns`}
      heading={<p className={headingClass}>{heading}</p>}
      gridClass="grid grid-cols-3 gap-2"
      initialIndex={patterns.findIndex((p) => p.id === active)}
      renderItem={(p) => (
        <HoverCard key={p.id} title={p.label} description={p.description}>
          <PatternPreviewTile
            active={active === p.id}
            label={p.shortLabel}
            onClick={() => onPick(p.id)}
            style={
              animated
                ? { backgroundColor, color: patternColor }
                : tabBackgroundStyle(p.id, { x: 0, y: 0 }, backgroundColor, patternColor)
            }
          >
            {animated ? <p.icon /> : null}
          </PatternPreviewTile>
        </HoverCard>
      )}
    />
  );
}

// One pattern option: the pattern drawn for real on the tab's canvas colour, its name beneath.
function PatternPreviewTile({
  active,
  label,
  onClick,
  style,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  style: CSSProperties;
  children?: ReactNode;
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
      >
        {children}
      </span>
      <span className="w-full truncate px-0.5 text-center text-[11px] font-medium">{label}</span>
    </button>
  );
}
