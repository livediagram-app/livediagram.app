'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { HoverCard } from './HoverCard';

/** One segment: its value, its words, an optional logo and what its hover card says. */
export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  // A mark drawn before the label at 16px (an app's logo), hidden from screen readers.
  logo?: ReactNode;
  // The hover card's line under the label: what the segment shows.
  description: string;
};

// The track wraps whole segments when they don't fit its place (Work Tracker 1384); a label never breaks inside itself.
const SEGMENTS =
  'flex max-w-full flex-wrap items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800';
// Wrapped (data-segments-wrapped on the track), each segment shares its row's width, so the rows read as one grid.
const SEGMENT_CELL = 'in-data-segments-wrapped:grow';
// 44 px to a thumb: a pad on one row, the segment itself once wrapped, where rows sit too close for pads.
const segment = (active: boolean) =>
  `relative flex h-7 cursor-pointer items-center justify-center whitespace-nowrap rounded px-2 text-xs font-medium transition-colors duration-micro touch-target-y in-data-segments-wrapped:grow pointer-coarse:in-data-segments-wrapped:h-11 ${
    active
      ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
  }`;

/** Whether a track's segments sit on more than one row: its first and last start at different heights. */
export function segmentsWrapped(track: HTMLElement): boolean {
  const first = track.firstElementChild;
  const last = track.lastElementChild;
  if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement) || first === last)
    return false;
  return first.offsetTop !== last.offsetTop;
}

// Tells whether the track has wrapped, again whenever its size changes; never in an environment with no layout.
function useWrapped() {
  const ref = useRef<HTMLDivElement>(null);
  const [wrapped, setWrapped] = useState(false);
  useLayoutEffect(() => {
    const track = ref.current;
    if (!track || typeof ResizeObserver === 'undefined') return;
    const check = () => setWrapped(segmentsWrapped(track));
    check();
    const observer = new ResizeObserver(check);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);
  return { ref, wrapped };
}

// A pane header's small "show this or that" switch (the Explorer's This app / All Apps, the Image Gallery's All /
// Unused): pressed-state buttons in one bordered track, each with a hover card naming what it shows, telling only a
// change. Each segment is a real button, so Tab reaches it and Enter or Space presses it.
export function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: T;
  onChange: (next: T) => void;
  options: readonly SegmentedOption<T>[];
  // The group's accessible name ("Show").
  label: string;
  className?: string;
}) {
  const { ref, wrapped } = useWrapped();
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      data-segments-wrapped={wrapped ? '' : undefined}
      className={`${SEGMENTS} ${className}`}
    >
      {options.map((option) => (
        <HoverCard
          key={option.value}
          title={option.label}
          description={option.description}
          className={SEGMENT_CELL}
        >
          <button
            type="button"
            aria-pressed={value === option.value}
            onClick={() => {
              if (value !== option.value) onChange(option.value);
            }}
            className={segment(value === option.value)}
          >
            {option.logo ? (
              <span aria-hidden className="mr-1.5 inline-flex shrink-0 [&_svg]:size-4">
                {option.logo}
              </span>
            ) : null}
            {option.label}
          </button>
        </HoverCard>
      ))}
    </div>
  );
}
