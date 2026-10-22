'use client';

// The swatch-button skin (docs/specs/004-interface-design/colour-picker.md "Skins"): a small
// swatch-only trigger (a toolbar's text colour, a data row's slice colour) opening the picker in a
// popover. A pick closes it and hands focus back to the trigger.
import { useState, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';
import { SwatchChip } from './ColourSwatch';
import { ColourPopover } from './ColourPopover';
import type { ColourPickerProps } from './ColourPicker';

export function ColourSwatchButton({
  swatch,
  none = false,
  children,
  className = '',
  preserveFocus = false,
  onPick,
  onOpenChange,
  triggerProps,
  ...picker
}: ColourPickerProps & {
  // Extra attributes for the trigger (a row's roving tabindex and key marker).
  triggerProps?: Record<string, string | number | undefined>;
  // The colour in force, drawn as the trigger's chip.
  swatch: string;
  none?: boolean;
  // A glyph in place of the chip (the rich-text toolbar's lettered A).
  children?: ReactNode;
  className?: string;
  // Keep focus where it is on press (a rich-text toolbar must not lose the text selection).
  preserveFocus?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpenState] = useState(false);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  // In state, not a ref: the popover is anchored to it during render.
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  return (
    <>
      <Tooltip label={picker.label}>
        <button
          ref={setTrigger}
          type="button"
          aria-label={picker.label}
          aria-haspopup="dialog"
          aria-expanded={open}
          {...triggerProps}
          onMouseDown={preserveFocus ? (e) => e.preventDefault() : undefined}
          onClick={() => setOpen(!open)}
          className={`group flex shrink-0 cursor-pointer items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className || 'h-6 w-6'}`}
        >
          {children ?? <SwatchChip colour={swatch} none={none} />}
        </button>
      </Tooltip>
      {open && trigger ? (
        <ColourPopover
          {...picker}
          anchor={trigger}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
            if (!preserveFocus) trigger.focus();
          }}
        />
      ) : null}
    </>
  );
}
