'use client';

import type { ReactNode } from 'react';

// A labelled slider row for the element menus (shadow, percentages, wordmark tracking and arc): the
// label over a range input and its value. `onRelease` hears the thumb let go (pointer, key or
// focus leaving), for a row that previews while it moves and commits once; `action` sits at the
// label's end (a reset).
export function MenuSliderRow({
  label,
  min,
  max,
  step,
  value,
  display,
  valueText,
  onChange,
  onRelease,
  action,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  // The value as read out beside the slider ("12px", "40%").
  display: string;
  // The accessible value, when it reads better than `display` ("90 degrees").
  valueText?: string;
  onChange: (value: number) => void;
  onRelease?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="px-3 py-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
        {action}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          aria-valuetext={valueText}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerUp={onRelease}
          onKeyUp={onRelease}
          onBlur={onRelease}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
        <span className="w-10 text-right text-xs font-medium tabular-nums text-slate-700 dark:text-slate-200">
          {display}
        </span>
      </div>
    </div>
  );
}
