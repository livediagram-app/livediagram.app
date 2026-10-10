'use client';

// A whole number with − and + either side (a Sheet's column width and row height, its font size): the field takes typing and
// applies on Enter or leaving it, kept within [min, max]; Escape or an empty field puts the value back. The arrow
// keys step it, as a native number field's do. The settings dialog's segmented control's look: a slate track with
// the value on white.
import { useState } from 'react';
import { Tooltip, lucideGlyph } from '@livediagram/ui';
import { lucideMinus, lucidePlus } from '@livediagram/icons/lucide';

const MinusGlyph = lucideGlyph(lucideMinus, 14);
const PlusGlyph = lucideGlyph(lucidePlus, 14);

export function NumberStepper({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  stepBy,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  // A unit shown after the value ("px").
  unit?: string;
  disabled?: boolean;
  // The next value for − and + (Word's font sizes step through presets); else `step` either way.
  stepBy?: (value: number, dir: 1 | -1) => number;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n)));
  const set = (n: number) => {
    const kept = clamp(n);
    if (kept !== value) onCommit(kept);
  };
  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    if (draft.trim() !== '') set(Number(draft));
  };
  const button = (dir: -1 | 1) => {
    const off = dir < 0 ? value <= min : value >= max;
    const name = `${dir < 0 ? 'Decrease' : 'Increase'} ${label}`;
    return (
      <Tooltip label={name}>
        <button
          type="button"
          aria-label={name}
          disabled={disabled || off}
          onClick={() => set(stepBy ? stepBy(value, dir) : value + dir * step)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-slate-900 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:shadow-none dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-50"
        >
          {dir < 0 ? <MinusGlyph /> : <PlusGlyph />}
        </button>
      </Tooltip>
    );
  };
  return (
    <span className="flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900">
      {button(-1)}
      <span className="flex h-7 items-center rounded-md bg-white px-1.5 shadow-sm dark:bg-slate-700">
        <input
          inputMode="numeric"
          aria-label={label}
          disabled={disabled}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            else if (e.key === 'Escape' && draft !== null) {
              // Only the draft: a second Escape reaches whatever holds the stepper.
              e.stopPropagation();
              setDraft(null);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              // From what is typed, when something is.
              const from = draft !== null && draft.trim() !== '' ? clamp(Number(draft)) : value;
              const dir = e.key === 'ArrowUp' ? 1 : -1;
              setDraft(null);
              set(stepBy ? stepBy(from, dir) : from + dir * step);
            }
          }}
          className="w-9 bg-transparent text-center text-xs font-medium tabular-nums text-slate-900 outline-none dark:text-slate-50"
        />
        {unit ? <span className="pl-0.5 text-[11px] text-slate-400">{unit}</span> : null}
      </span>
      {button(1)}
    </span>
  );
}
