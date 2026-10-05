'use client';

import { useRef, type KeyboardEvent } from 'react';
import { COMMUNITY_CATEGORIES, type CommunityCategory } from '@livediagram/api-schema';

// The publish dialog's category tiles (docs/specs/025-community/community.md "Categories"): exactly
// one, from the closed set, in display order. A radio group: one tab stop (the chosen tile, or the
// first when none is), arrow keys move and choose, as a native radio group does.
export function CategoryPicker({
  value,
  onChange,
  labelledBy,
  describedBy,
  invalid = false,
  disabled = false,
}: {
  value: CommunityCategory | null;
  onChange: (category: CommunityCategory) => void;
  // The id of the visible "Category" label.
  labelledBy: string;
  // The id of the field's validation message, when it has one.
  describedBy?: string;
  // No category chosen on a submit: every tile takes the error border until one is picked.
  invalid?: boolean;
  disabled?: boolean;
}) {
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const focusIndex = Math.max(
    0,
    COMMUNITY_CATEGORIES.findIndex((c) => c.id === value),
  );

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + COMMUNITY_CATEGORIES.length) % COMMUNITY_CATEGORIES.length;
    onChange(COMMUNITY_CATEGORIES[next]!.id);
    tiles.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {COMMUNITY_CATEGORIES.map((category, index) => {
        const checked = category.id === value;
        return (
          <button
            key={category.id}
            ref={(el) => {
              tiles.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={index === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(category.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={`flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
              checked
                ? 'border-brand-400 bg-brand-50 ring-1 ring-brand-400 dark:border-brand-400/70 dark:bg-brand-500/15 dark:ring-brand-400/70'
                : invalid
                  ? 'border-rose-300 bg-white hover:border-rose-400 hover:bg-rose-50/50 dark:border-rose-500/50 dark:bg-slate-900 dark:hover:bg-rose-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            <span
              className={`text-sm font-medium ${
                checked
                  ? 'text-brand-700 dark:text-brand-200'
                  : 'text-slate-800 dark:text-slate-100'
              }`}
            >
              {category.label}
            </span>
            <span className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {category.blurb}
            </span>
          </button>
        );
      })}
    </div>
  );
}
