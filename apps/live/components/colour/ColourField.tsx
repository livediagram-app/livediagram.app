'use client';

// The field skin (docs/specs/004-interface-design/colour-picker.md "Skins"): a field-sized trigger
// showing the colour in force (its chip and name, or the surface's no-colour name) and a chevron,
// opening the picker in a popover under it. A pick closes it and hands focus back to the trigger.
import { useState } from 'react';
import { ChevronDownIcon } from '@livediagram/ui';
import { SwatchChip } from './ColourSwatch';
import { ColourPopover } from './ColourPopover';
import type { ColourPickerProps } from './ColourPicker';

export function ColourField({
  id,
  disabled = false,
  swatch,
  name,
  none = false,
  onPick,
  ...picker
}: ColourPickerProps & {
  id?: string;
  disabled?: boolean;
  // What the trigger shows: the colour in force, and its name.
  swatch: string;
  name: string;
  // The colour in force is no colour.
  none?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // In state, not a ref: the popover is anchored to it during render.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <button
        ref={setTrigger}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={`${picker.label}: ${name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-left text-[13px] text-slate-800 transition hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600"
      >
        <SwatchChip colour={swatch} none={none} small />
        <span
          className={`min-w-0 flex-1 truncate ${none ? 'text-slate-500 dark:text-slate-400' : ''}`}
        >
          {name}
        </span>
        <ChevronDownIcon className="shrink-0 text-slate-400" />
      </button>
      {open && trigger ? (
        <ColourPopover
          {...picker}
          anchor={trigger}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
            trigger.focus();
          }}
        />
      ) : null}
    </>
  );
}
