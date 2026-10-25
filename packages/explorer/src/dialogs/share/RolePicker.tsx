'use client';

// The new pass's level: one compact card naming the chosen level, which unfolds the three levels beneath it when
// pressed (a click, never a hover). It unfolds in place rather than floating, so the dialog's scroll never clips it
// and nothing covers the fine print. Choosing a level folds it again. livediagram's ShareRolePicker from before the
// Explorer split, in each app's words.

import { useId, useState, type KeyboardEvent } from 'react';
import type { Level } from '@liveworkspace/index-client';
import { CheckIcon, ChevronDownIcon } from '@liveworkspace/ui';
import { LEVEL_ORDER, LEVEL_PASS } from './parts';

export function RolePicker({
  level,
  onChange,
}: {
  level: Level;
  onChange: (level: Level) => void;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const pass = LEVEL_PASS[level];

  const choose = (next: Level) => {
    onChange(next);
    setOpen(false);
  };

  // Arrow keys walk the levels, wrapping; Home and End reach the ends, as in any radio group.
  const onLevelKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape') {
      // Folds the list, and leaves the dialog open.
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setOpen(false);
      return;
    }
    const i = LEVEL_ORDER.indexOf(level);
    const last = LEVEL_ORDER.length - 1;
    const to: Record<string, number> = {
      ArrowUp: i - 1,
      ArrowLeft: i - 1,
      ArrowDown: i + 1,
      ArrowRight: i + 1,
      Home: 0,
      End: last,
    };
    if (!(e.key in to)) return;
    e.preventDefault();
    const next = LEVEL_ORDER[(to[e.key]! + LEVEL_ORDER.length) % LEVEL_ORDER.length]!;
    onChange(next);
    e.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-level="${next}"]`)
      ?.focus();
  };

  return (
    <div
      className={`overflow-hidden rounded-xl border-2 transition-[border-color,box-shadow] duration-short motion-reduce:transition-none ${pass.selected} ${
        open ? 'shadow-md' : 'shadow-sm'
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Pass level: ${pass.title}. Change level`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === 'Escape' && open) {
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            setOpen(false);
          }
        }}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${pass.solid}`}
        >
          <pass.Icon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {pass.title}
          </span>
          <span className="truncate text-[11px] leading-snug text-slate-600 dark:text-slate-400">
            {pass.blurb}
          </span>
        </span>
        <ChevronDownIcon
          className={`shrink-0 text-slate-400 transition-transform duration-short motion-reduce:transition-none ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {/* Unfolds by easing its row from 0fr to 1fr; inert while folded so the hidden levels take no focus. */}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-short ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
        inert={!open}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            id={listId}
            role="radiogroup"
            aria-label="What the pass lets people do"
            className="flex flex-col gap-1 border-t border-slate-200/70 p-1.5 dark:border-slate-700/70"
          >
            {LEVEL_ORDER.map((l) => {
              const option = LEVEL_PASS[l];
              const active = l === level;
              return (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  data-level={l}
                  onClick={() => choose(l)}
                  onKeyDown={onLevelKey}
                  className={`flex items-center gap-3 rounded-lg bg-white/70 px-2 py-1.5 text-left transition-colors duration-micro dark:bg-slate-900/40 ${
                    active ? option.chosen : option.hover
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${option.solid}`}
                  >
                    <option.Icon />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={`text-[13px] font-semibold ${option.text}`}>
                      {option.title}
                    </span>
                    <span className="text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                      {option.blurb}
                    </span>
                  </span>
                  {active ? (
                    <span
                      aria-hidden
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${option.solid}`}
                    >
                      <CheckIcon size={10} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The selection pill of a segmented control: one element that slides to the chosen segment. The track is
 *  `relative`, drawn with a ring, its segments equal columns with no gap; the pill fills it edge to edge, the height
 *  of the button beside it. Segments sit above it (`relative z-10`); `className` carries its fill and shadow. */
export function SegmentSlider({
  count,
  index,
  className,
}: {
  count: number;
  index: number;
  className: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 left-0 rounded-md transition-[transform,opacity,background-color] duration-short ease-out motion-reduce:transition-none ${className} ${
        index < 0 ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        width: `calc(100% / ${count})`,
        transform: `translateX(${Math.max(index, 0) * 100}%)`,
      }}
    />
  );
}
