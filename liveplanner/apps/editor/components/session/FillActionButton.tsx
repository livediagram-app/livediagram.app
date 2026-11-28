'use client';

// The fill button (docs/specs/026-plan/session-tabs.md "The action bar"), shared by every session kind: pressed, a
// lighter wash fills it left to right over the theme's accent, its label turns into a tick, then the wash drains back
// out, about FILL_MS in all. `onConfirm` runs as the fill completes, so the tick shows while the work lands. Under
// reduced motion it swaps to the tick and back with no fill. A press while it runs is ignored.
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { PREFERS_REDUCED_MOTION, lucideGlyph, useMediaQuery } from '@liveworkspace/ui';
import { lucideCheck } from '@liveworkspace/icons/lucide';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';

const TickIcon = lucideGlyph(lucideCheck, 18);

// The whole press, in and out: the fill, the tick held, the drain.
export const FILL_IN_MS = 250;
export const FILL_HOLD_MS = 200;
export const FILL_DRAIN_MS = 250;
export const FILL_MS = FILL_IN_MS + FILL_HOLD_MS + FILL_DRAIN_MS;
// Under reduced motion: how long the tick shows.
export const FILL_STILL_MS = 400;

type Phase = 'idle' | 'fill' | 'done' | 'drain';

export function FillActionButton({
  label,
  icon,
  onConfirm,
  disabled = false,
  shortcut,
  ref,
}: {
  label: string;
  icon?: ReactNode;
  onConfirm: () => void;
  disabled?: boolean;
  // The key that presses it, for aria-keyshortcuts and the tooltip line.
  shortcut?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  const reduced = useMediaQuery(PREFERS_REDUCED_MOTION);
  const [phase, setPhase] = useState<Phase>('idle');
  const timers = useRef<number[]>([]);
  // The latest onConfirm, so a press confirms what is on screen when the fill completes.
  const confirm = useLatest(onConfirm);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const after = (ms: number, then: () => void) => {
    timers.current.push(window.setTimeout(then, ms));
  };
  const press = () => {
    if (phase !== 'idle' || disabled) return;
    if (reduced) {
      confirm.current();
      setPhase('done');
      after(FILL_STILL_MS, () => setPhase('idle'));
      return;
    }
    setPhase('fill');
    after(FILL_IN_MS, () => {
      confirm.current();
      setPhase('done');
      after(FILL_HOLD_MS, () => {
        setPhase('drain');
        after(FILL_DRAIN_MS, () => setPhase('idle'));
      });
    });
  };
  const ticked = phase === 'done' || phase === 'drain';
  // The wash: grows from the left as it fills, shrinks to the right as it drains, and resets unseen.
  const wash =
    phase === 'fill' || phase === 'done'
      ? `origin-left scale-x-100 ${phase === 'fill' ? 'transition-transform duration-[250ms] ease-out' : ''}`
      : phase === 'drain'
        ? 'origin-right scale-x-0 transition-transform duration-[250ms] ease-in'
        : 'origin-left scale-x-0';
  return (
    <button
      ref={ref}
      type="button"
      onClick={press}
      disabled={disabled}
      aria-keyshortcuts={shortcut?.toUpperCase()}
      data-fill-phase={phase}
      className="relative inline-flex h-10 min-w-[8.5rem] cursor-pointer max-sm:min-w-0 max-sm:flex-1 items-center justify-center overflow-hidden rounded-lg bg-brand-700 px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-800 dark:bg-brand-600 dark:hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-slate-900"
    >
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-white/30 ${reduced ? 'hidden' : wash}`}
      />
      <span className="relative grid place-items-center">
        <span
          className={`col-start-1 row-start-1 inline-flex items-center gap-2 transition-opacity duration-150 ${ticked ? 'opacity-0' : 'opacity-100'}`}
        >
          {icon}
          {label}
          {shortcut ? (
            <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 py-px font-sans text-[11px] font-medium sm:inline">
              {shortcut.toUpperCase()}
            </kbd>
          ) : null}
        </span>
        <span
          aria-hidden
          className={`col-start-1 row-start-1 transition-opacity duration-150 ${ticked ? 'opacity-100' : 'opacity-0'}`}
        >
          <TickIcon size={20} />
        </span>
      </span>
    </button>
  );
}
