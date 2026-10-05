'use client';

import { useId, useRef, type KeyboardEvent } from 'react';
import { COMMUNITY_CATEGORIES, type CommunityCategory } from '@livediagram/api-schema';

// The publish dialog's category chips (docs/specs/025-community/community.md "Categories"): exactly
// one, from the closed set, in display order. Compact single-line chips that wrap, with the chosen
// category's description shown once beneath them rather than on every chip, so eleven choices fit in a
// few lines. A radio group: one tab stop (the chosen chip, or the first when none is), arrow keys move
// and choose, as a native radio group does.
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
  // No category chosen on a submit: every chip takes the error border until one is picked.
  invalid?: boolean;
  disabled?: boolean;
}) {
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);
  const hintId = useId();
  const chosen = COMMUNITY_CATEGORIES.find((c) => c.id === value);
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
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={[describedBy, hintId].filter(Boolean).join(' ')}
        aria-invalid={invalid || undefined}
        className="flex flex-wrap gap-1.5"
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
              className={`rounded-full border px-3 py-1 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                checked
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/25 dark:border-brand-400 dark:bg-brand-500'
                  : invalid
                    ? 'border-rose-300 bg-white text-slate-700 hover:border-rose-400 hover:bg-rose-50/50 dark:border-rose-500/50 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-rose-500/10'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800'
              }`}
            >
              {category.label}
            </button>
          );
        })}
      </div>
      <p id={hintId} className="text-xs text-slate-500 dark:text-slate-400">
        {chosen ? chosen.blurb : 'Choose the one that fits best.'}
      </p>
    </div>
  );
}
