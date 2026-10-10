'use client';

// A row of equal segments, one chosen, its highlight sliding between them (SegmentSlider): a
// radiogroup of short choices (a guide strength, a number of copies).
import { ACTIVE_SEGMENT, SEGMENT_TRACK } from '@livediagram/ui';
import { SegmentSlider } from './SegmentSlider';

export function SegmentedRadio<T extends string | number>({
  label,
  options,
  value,
  onChange,
  className = '',
}: {
  // The group's accessible name.
  label: string;
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`relative grid rounded-lg p-0.5 ${SEGMENT_TRACK} ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <SegmentSlider
        count={options.length}
        index={options.findIndex((o) => o.id === value)}
        className={ACTIVE_SEGMENT}
      />
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`relative z-10 rounded-md py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-brand-600 ${
              on
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
