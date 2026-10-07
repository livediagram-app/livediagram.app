'use client';

// The twelve Plan swatches as one radio group (docs/specs/026-plan/items.md "Colour"): a card type's Colour in the
// type editor, and an item's own Colour in the item panel, which adds None. ColourDot draws an item's colour
// beside its type colour (a Parent chip, a Project swimlane header, a Gantt row).
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { PLAN_TYPE_COLOURS } from '@livediagram/items';
import { ChevronDownIcon, useClickOutside, useEscape } from '@livediagram/ui';

// The swatches' names, for their buttons.
export const COLOUR_NAMES: Record<string, string> = {
  '#18181b': 'Black',
  '#71717a': 'Gray',
  '#2563eb': 'Blue',
  '#eab308': 'Yellow',
  '#dc2626': 'Red',
  '#16a34a': 'Green',
  '#7c3aed': 'Violet',
  '#d97706': 'Amber',
  '#0d9488': 'Teal',
  '#db2777': 'Pink',
  '#ea580c': 'Orange',
  '#0891b2': 'Cyan',
};

// The arrows that move focus along the swatches (a radio group's roving focus): back or forward, wrapping.
const SWATCH_STEP: Record<string, -1 | 1> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

// Where a key moves focus among `count` swatches from `at`: an arrow steps (wrapping), Home and End jump to the
// ends; any other key, nowhere (-1).
export function swatchFocusTarget(key: string, at: number, count: number): number {
  if (count <= 0 || at < 0) return -1;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = SWATCH_STEP[key];
  return step ? (at + step + count) % count : -1;
}

export function ColourSwatches({
  value,
  onChange,
  label = 'Colour',
  allowNone = false,
  disabled = false,
  size = 'md',
  id,
}: {
  // The picked swatch, or undefined for none.
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  label?: string;
  // Offers None first, which clears the colour.
  allowNone?: boolean;
  disabled?: boolean;
  // md for the type editor, sm for the item panel's narrower column.
  size?: 'sm' | 'md';
  id?: string;
}) {
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const ring = (on: boolean) =>
    `${dim} shrink-0 rounded-full ring-offset-2 transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:ring-offset-slate-900 ${
      on ? 'ring-2 ring-brand-500' : disabled ? '' : 'hover:scale-110'
    } disabled:cursor-not-allowed disabled:opacity-60`;
  // The swatches in order (None first when offered). The picked one is the group's one Tab stop (the first when
  // none listed is picked); the arrows move focus along them, and Enter or Space (a button's own keys) picks.
  const options: (string | undefined)[] = allowNone
    ? [undefined, ...PLAN_TYPE_COLOURS]
    : [...PLAN_TYPE_COLOURS];
  const picked = options.indexOf(value);
  const tabStop = picked < 0 ? 0 : picked;
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const next = swatchFocusTarget(
      e.key,
      radios.indexOf(e.target as HTMLButtonElement),
      radios.length,
    );
    if (next < 0) return;
    e.preventDefault();
    radios[next]?.focus();
  };
  return (
    <div
      id={id}
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-1.5"
      onKeyDown={onKeyDown}
    >
      {options.map((c, i) =>
        c === undefined ? (
          <button
            key="none"
            type="button"
            role="radio"
            aria-checked={value === undefined}
            aria-label="None"
            tabIndex={i === tabStop ? 0 : -1}
            disabled={disabled}
            className={`${ring(value === undefined)} relative flex items-center justify-center border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900`}
            onClick={() => onChange(undefined)}
          >
            {/* A slash: no colour. */}
            <span aria-hidden className="h-px w-3/4 rotate-45 bg-slate-400 dark:bg-slate-500" />
          </button>
        ) : (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={value === c}
            aria-label={COLOUR_NAMES[c] ?? c}
            tabIndex={i === tabStop ? 0 : -1}
            disabled={disabled}
            className={ring(value === c)}
            style={{ backgroundColor: c }}
            onClick={() => onChange(c)}
          />
        ),
      )}
    </div>
  );
}

// The width of ColourSelect's swatch popover: seven sm swatches to a row.
const COLOUR_POPOVER_PX = 232;

// An item's own Colour in the card panel (docs/specs/026-plan/items.md "Colour"): one quiet field-sized trigger
// showing the colour's dot and name (or None), opening the swatches (with None) in a small popover under it. The
// popover is drawn in place, inside the field (as LinkedCardField draws its list), so the card panel's focus trap
// keeps it: opening moves focus to the picked swatch, the arrows move along them, and Enter or Space picks. A pick
// closes it, as do Escape (which stays here, so the card panel stays open, and hands focus back to the trigger),
// Tab out of it and a press outside. It hangs from the field's right edge, so it stays inside the Details column.
export function ColourSelect({
  value,
  onChange,
  label = 'Colour',
  disabled = false,
  id,
}: {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const popId = useId();
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  // Escape closes the popover only, before the panel's own Escape (which would close the card).
  useEscape(() => close(), {
    enabled: open,
    capture: true,
    stopPropagation: true,
    preventDefault: true,
  });
  // A press outside the field closes it.
  useClickOutside(boxRef, () => close(false), open);
  // Opened, focus goes to the picked swatch (None when there is none), and the popover scrolls into view should it
  // hang below the Details column's fold.
  useEffect(() => {
    if (!open) return;
    pop.current?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus();
    pop.current?.scrollIntoView?.({ block: 'nearest' });
  }, [open]);
  const name = value ? (COLOUR_NAMES[value] ?? value) : 'None';
  return (
    <div
      ref={boxRef}
      className="relative w-full"
      // Tab out of the popover (focus leaving the field) closes it.
      onBlur={(e) => {
        if (open && !boxRef.current?.contains(e.relatedTarget as Node | null)) close(false);
      }}
    >
      <button
        ref={trigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={`${label}: ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-left text-[13px] text-slate-800 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {value ? (
          <span
            aria-hidden
            className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20"
            style={{ backgroundColor: value }}
          />
        ) : (
          <span
            aria-hidden
            className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-300 dark:border-slate-600"
          >
            <span className="h-px w-2.5 rotate-45 bg-slate-400 dark:bg-slate-500" />
          </span>
        )}
        <span
          className={`min-w-0 flex-1 truncate ${value ? '' : 'text-slate-500 dark:text-slate-400'}`}
        >
          {name}
        </span>
        <ChevronDownIcon className="shrink-0 text-slate-400" />
      </button>
      {open ? (
        <div
          ref={pop}
          id={popId}
          role="dialog"
          aria-label={label}
          // Focusable by a press only: a browser that never focuses a pressed button (Safari) moves focus here
          // instead, still inside the field, so the blur above does not close it before the pick lands.
          tabIndex={-1}
          className="absolute right-0 top-full z-20 mt-1 rounded-lg outline-none border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          style={{ width: COLOUR_POPOVER_PX }}
        >
          <ColourSwatches
            value={value}
            label={label}
            allowNone
            size="sm"
            onChange={(c) => {
              onChange(c);
              close();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

// An item's own colour as a small ringed dot, named for a screen reader by its swatch.
export function ColourDot({ colour, className = '' }: { colour: string; className?: string }) {
  return (
    <span
      role="img"
      aria-label={`${COLOUR_NAMES[colour] ?? 'Own'} colour`}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20 ${className}`}
      style={{ backgroundColor: colour }}
    />
  );
}
