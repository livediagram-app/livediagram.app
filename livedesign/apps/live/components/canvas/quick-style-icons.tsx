'use client';

// What a Quick Style bar button draws (docs/specs/008-canvas/quick-style-panel.md "Where it sits"): the colour in
// force as a chip, or the glyph of the option in force; a mixed selection a split chip, or the first option's glyph
// muted.

import type { ReactNode } from 'react';
import { QUICK_TRANSPARENT } from '@/lib/quick-style';

// Stroke an outline in the colour, Fill a filled square, Text an "A" over a bar of it, Marker a dot, Highlighter a
// band.
export type ChipKind = 'stroke' | 'fill' | 'text' | 'dot' | 'band';

// Transparent is the no-colour chip's diagonal; a mixed selection splits the chip in two greys.
const MIXED = 'linear-gradient(135deg, #94a3b8 0 50%, #e2e8f0 50% 100%)';
const NONE =
  'linear-gradient(to top right, transparent calc(50% - 0.75px), #ef4444 calc(50% - 0.75px), #ef4444 calc(50% + 0.75px), transparent calc(50% + 0.75px)), #ffffff';
const EDGE = 'ring-1 ring-inset ring-black/15 dark:ring-white/25';

/** A 14 px chip of `paint` (null: mixed). */
export function ColourChip({ kind, paint }: { kind: ChipKind; paint: string | null }) {
  const fill = paint === null ? MIXED : paint === QUICK_TRANSPARENT ? NONE : paint;
  const data = { 'aria-hidden': true, 'data-chip': '', 'data-paint': paint ?? 'mixed' } as const;
  if (kind === 'text') {
    return (
      <span {...data} className="flex size-4 flex-col items-center justify-center leading-none">
        <span className="text-[11px] font-bold leading-none">A</span>
        <span className={`mt-px h-[3px] w-3 rounded-full ${EDGE}`} style={{ background: fill }} />
      </span>
    );
  }
  if (kind === 'stroke') {
    return (
      <span {...data} className="relative block size-3.5 rounded-[4px]">
        <span className="absolute inset-0 rounded-[4px]" style={{ background: fill }} />
        {/* The page shows through the chip's middle, so it reads as a line, not a fill. */}
        <span className="absolute inset-[3px] rounded-[2px] bg-white ring-1 ring-black/10 dark:bg-slate-900 dark:ring-white/15" />
      </span>
    );
  }
  if (kind === 'dot') {
    return (
      <span {...data} className="flex size-4 items-center justify-center">
        <span className={`block size-3 rounded-full ${EDGE}`} style={{ background: fill }} />
      </span>
    );
  }
  if (kind === 'band') {
    return (
      <span {...data} className="flex size-4 items-center justify-center">
        <span
          className={`block h-2 w-4 -rotate-12 rounded-[2px] ${EDGE}`}
          style={{ background: fill }}
        />
      </span>
    );
  }
  return (
    <span
      {...data}
      className={`block size-3.5 rounded-[4px] ${EDGE}`}
      style={{ background: fill }}
    />
  );
}

/** The glyph of the option in force at 16 px; muted (the first option's, by the caller) when mixed. */
export function ValueGlyph({ mixed, children }: { mixed: boolean; children: ReactNode }) {
  return (
    <span
      aria-hidden
      data-mixed={mixed ? '' : undefined}
      className={`flex size-4 items-center justify-center [&>svg]:size-4 ${mixed ? 'opacity-45' : ''}`}
    >
      {children}
    </span>
  );
}
