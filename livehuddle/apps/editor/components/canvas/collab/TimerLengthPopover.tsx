'use client';

import { useState } from 'react';
import { PopoverOrSheet } from '@liveworkspace/workbench/components/primitives/PopoverOrSheet';
import { Button } from '@livehuddle/ui';
import {
  TIMER_MINUTES_MAX,
  TIMER_MINUTES_MIN,
  TIMER_PRESET_MINUTES,
  clampTimerMinutes,
} from '@livehuddle/document';

// The Timer length popover (docs/specs/009-elements/timer-and-stopwatch.md "The controls"): preset chips (5, 10, 15,
// 25 min), a minutes field with − and +, and Set Timer. Setting a length resets the Timer to it: a new round. On a phone
// it is a drawer from the screen's foot (liveworkspace/docs/specs/011-workbench/phone-drawers.md), its targets a
// thumb's size.

const STEP = 'cursor-pointer !px-0 text-[15px] font-semibold';

export function TimerLengthPopover({
  anchor,
  minutes: current,
  onSet,
  onClose,
}: {
  anchor: HTMLElement;
  /** The Timer's length now, in minutes. */
  minutes: number;
  onSet: (minutes: number) => void;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState(current);
  const [draft, setDraft] = useState(String(current));
  const pick = (m: number) => {
    const next = clampTimerMinutes(m);
    setMinutes(next);
    setDraft(String(next));
  };
  return (
    <PopoverOrSheet anchor={anchor} name="Timer length" width={248} align="start" onClose={onClose}>
      {(sheet) => (
        <form
          className={sheet ? 'flex flex-col gap-4 px-4 pb-4' : 'flex flex-col gap-3 p-3'}
          onSubmit={(e) => {
            e.preventDefault();
            onSet(minutes);
          }}
        >
          <h2
            className={`${sheet ? 'text-[15px]' : 'text-[13px]'} font-semibold text-slate-800 dark:text-slate-100`}
          >
            Timer Length
          </h2>
          <div className="flex gap-1.5" role="group" aria-label="Presets">
            {TIMER_PRESET_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={minutes === m}
                onClick={() => pick(m)}
                className={`flex flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-full border px-1 ${sheet ? 'h-10' : 'py-1'} text-[12px] font-semibold tabular-nums transition-colors ${
                  minutes === m
                    ? 'border-brand-500 bg-brand-50 text-brand-800 dark:border-brand-400 dark:bg-brand-500/20 dark:text-brand-100'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="text-optical-line">{m} min</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="xs"
              className={`${STEP} ${sheet ? 'h-10 w-10' : 'h-8 w-8'}`}
              aria-label="One minute less"
              disabled={minutes <= TIMER_MINUTES_MIN}
              onClick={() => pick(minutes - 1)}
            >
              −
            </Button>
            <label
              className={`flex flex-1 items-center gap-1.5 rounded-md border border-slate-200 px-2 ${sheet ? 'h-10' : 'py-1'} focus-within:border-brand-600 dark:border-slate-600`}
            >
              <input
                type="number"
                inputMode="numeric"
                min={TIMER_MINUTES_MIN}
                max={TIMER_MINUTES_MAX}
                value={draft}
                aria-label="Minutes"
                onChange={(e) => {
                  setDraft(e.target.value);
                  const n = Number(e.target.value);
                  if (e.target.value !== '' && Number.isFinite(n)) setMinutes(clampTimerMinutes(n));
                }}
                onBlur={() => setDraft(String(minutes))}
                className="w-full min-w-0 bg-transparent text-[14px] font-semibold tabular-nums text-slate-800 outline-none dark:text-slate-100"
              />
              <span className="text-[12px] text-slate-500 dark:text-slate-400">min</span>
            </label>
            <Button
              variant="secondary"
              size="xs"
              className={`${STEP} ${sheet ? 'h-10 w-10' : 'h-8 w-8'}`}
              aria-label="One minute more"
              disabled={minutes >= TIMER_MINUTES_MAX}
              onClick={() => pick(minutes + 1)}
            >
              +
            </Button>
          </div>
          <Button
            type="submit"
            variant="primary"
            size={sheet ? 'sm' : 'xs'}
            className={`w-full cursor-pointer ${sheet ? 'h-11' : ''}`}
          >
            Set Timer
          </Button>
        </form>
      )}
    </PopoverOrSheet>
  );
}
