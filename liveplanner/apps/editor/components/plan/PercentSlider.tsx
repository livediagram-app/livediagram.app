'use client';

// A Percent field in the card panel (docs/specs/026-plan/item-types.md "Percent"): a draggable bar and the number
// beside it. Dragging draws the share live in local state and saves once on release, so a drag is one change (one
// undo step) and never floods the plan with writes; each key press is one change; the box saves on Enter or leaving
// it, rounded and held to 0 to 100, emptying it clears the field, Escape puts it back. Someone who may only view sees
// the bar and the number (PercentReading).
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { PERCENT_MAX, PERCENT_MIN, percentText, percentValue } from '@liveplanner/items';
import { clampPercent } from '@liveplanner/project';
import { PercentBar, PercentReading } from './PercentBar';

// The steps the keys take: the arrows one, Page Up and Page Down ten.
const STEP = 1;
const PAGE = 10;

const KEY_STEPS: Readonly<Record<string, (n: number) => number>> = {
  ArrowLeft: (n) => n - STEP,
  ArrowDown: (n) => n - STEP,
  ArrowRight: (n) => n + STEP,
  ArrowUp: (n) => n + STEP,
  PageDown: (n) => n - PAGE,
  PageUp: (n) => n + PAGE,
  Home: () => PERCENT_MIN,
  End: () => PERCENT_MAX,
};

// The share under a pointer on the track: its place across the track's width, rounded and held to 0..100.
export function shareAt(clientX: number, rect: Pick<DOMRect, 'left' | 'width'>): number {
  if (rect.width <= 0) return PERCENT_MIN;
  return clampPercent(((clientX - rect.left) / rect.width) * 100);
}

// What the box's text saves: undefined to clear, a share, or null when it is no number (the box is put back).
export function typedShare(raw: string): number | undefined | null {
  const t = raw.trim();
  if (t === '') return undefined;
  return percentValue(t) ?? null;
}

export function PercentSlider({
  id,
  label,
  value: stored,
  disabled,
  onSave,
}: {
  id: string;
  label: string;
  value: unknown;
  disabled: boolean;
  onSave: (value: number | undefined) => void;
}) {
  const value = percentValue(typeof stored === 'number' ? stored : undefined);
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  if (disabled)
    return value === undefined ? (
      <span
        id={id}
        className="flex min-h-7 items-center text-[13px] text-slate-500 dark:text-slate-400"
      >
        None
      </span>
    ) : (
      <PercentReading id={id} value={value} />
    );
  const shown = drag ?? value;
  const save = (n: number) => {
    const next = clampPercent(n);
    if (next !== value) onSave(next);
  };
  const at = (e: PointerEvent) => shareAt(e.clientX, track.current!.getBoundingClientRect());
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.focus();
    setDrag(at(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    setDrag(at(e));
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (drag === null) return;
    const next = at(e);
    setDrag(null);
    save(next);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    save(step(value ?? PERCENT_MIN));
  };
  const empty = shown === undefined;
  return (
    <div className="flex min-h-7 items-center gap-3">
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={PERCENT_MIN}
        aria-valuemax={PERCENT_MAX}
        aria-valuenow={shown ?? PERCENT_MIN}
        aria-valuetext={empty ? 'No value' : percentText(shown)}
        className="group relative flex h-7 min-w-16 flex-1 cursor-pointer touch-none items-center rounded-full px-2 outline-none pointer-coarse:h-11"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={onKeyDown}
      >
        <div ref={track} className="relative h-1.5 w-full">
          <PercentBar value={shown} className="h-1.5 w-full" />
          <span
            aria-hidden
            className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-white shadow-sm transition-[transform,box-shadow] group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-brand-200 pointer-coarse:h-5 pointer-coarse:w-5 dark:bg-slate-900 dark:group-focus-visible:ring-brand-500/40 ${
              empty
                ? 'border-slate-300 dark:border-slate-600'
                : 'border-brand-600 dark:border-brand-400'
            } ${drag !== null ? 'scale-110' : ''}`}
            style={{ left: `${shown ?? PERCENT_MIN}%` }}
          />
        </div>
      </div>
      <label className="flex w-[4.25rem] shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[13px] transition focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:focus-within:ring-brand-500/30">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          // The live share while dragging; the stored one otherwise (a remote change resets an untouched box).
          key={shown ?? 'none'}
          defaultValue={shown ?? ''}
          placeholder="–"
          aria-label={`${label}, percent`}
          className="w-full min-w-0 bg-transparent text-right tabular-nums text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              e.currentTarget.value = value === undefined ? '' : String(value);
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            const next = typedShare(e.target.value);
            if (next === undefined) {
              if (value !== undefined) onSave(undefined);
            } else if (next === null) {
              e.target.value = value === undefined ? '' : String(value);
            } else {
              e.target.value = String(next);
              if (next !== value) onSave(next);
            }
          }}
        />
        <span aria-hidden className="text-slate-400 dark:text-slate-500">
          %
        </span>
      </label>
    </div>
  );
}
