'use client';

import type { ReactNode } from 'react';
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

const SEGMENTS =
  'flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800';
const segment = (active: boolean) =>
  `flex h-7 cursor-pointer items-center justify-center rounded px-2 text-xs font-medium transition-colors duration-micro ${
    active
      ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-200'
      : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
  }`;

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
  return (
    <div role="group" aria-label={label} className={`${SEGMENTS} ${className}`}>
      {options.map((option) => (
        <HoverCard key={option.value} title={option.label} description={option.description}>
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
