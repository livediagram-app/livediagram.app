'use client';

// The pills that lead a board's widgets without anyone adding them (docs/specs/026-plan/board-widgets.md "The header"):
// a Form pill (FormBoardStrip) and the Roadmap pill (RoadmapBoardPill), in one shape. A glyph, the name (truncating
// first, and kept out of sight on a phone: still the pill's accessible name), a state dot read out, what the pill
// adds, then its icon buttons. Short of room it gives way inside the header's padding, never under the top-right corner
// card (Work Tracker 1288). A press on it never moves the board.
import type { ReactNode } from 'react';
import { Tooltip } from '@liveplanner/ui';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { WIDGET_PILL_SHRINKS } from './board-widget-parts';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The green of a form taking responses and of a published roadmap.
export const STRIP_LIVE_DOT = '#10b981';

export function BoardStripPill({
  kind,
  label,
  glyph,
  name,
  dot,
  state,
  palette,
  children,
}: {
  // Names its data attributes (`data-form-strip-name`, `data-roadmap-strip-name`).
  kind: 'form' | 'roadmap';
  // The pill's accessible name.
  label: string;
  glyph: ReactNode;
  name: string;
  // The dot's colour, and the state it stands for (read out).
  dot: string;
  state: string;
  palette: PlanPalette;
  // After the dot: what the pill adds (a count) and its buttons.
  children: ReactNode;
}) {
  return (
    <span
      role="group"
      aria-label={label}
      {...{ [`data-${kind}-pill`]: '' }}
      className={`${WIDGET_PILL_SHRINKS} gap-1 pr-0.5`}
      style={{ borderColor: palette.border, background: palette.surface, color: palette.text }}
      onPointerDown={stop}
    >
      <span aria-hidden className="flex shrink-0" style={{ color: palette.muted }}>
        {glyph}
      </span>
      <span
        {...{ [`data-${kind}-strip-name`]: '' }}
        className="min-w-0 max-w-[10rem] truncate font-semibold phone:sr-only"
      >
        {name}
      </span>
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dot }} />
      <span className="sr-only">{state}.</span>
      {children}
    </span>
  );
}

const BUTTON =
  'flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 dark:hover:bg-white/10';

/** One of a strip pill's icon buttons, with its tooltip. `className` adds to it (`phone:hidden`). */
export function BoardStripButton({
  tooltip,
  label,
  onClick,
  className = '',
  children,
}: {
  tooltip: string;
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tooltip label={tooltip}>
      <button
        type="button"
        aria-label={label}
        className={`${BUTTON} ${className}`}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}
