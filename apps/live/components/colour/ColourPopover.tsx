'use client';

// The picker in a popover (docs/specs/004-interface-design/colour-picker.md "Skins"), anchored to the
// trigger that opened it: the field and swatch-button skins open it. Opening focuses the picker's
// Tab stop (the picked swatch); Escape and a press outside close it, Escape handing focus back to
// the trigger (AnchoredPopover).
import { useEffect, useRef } from 'react';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';
import { ColourPicker, type ColourPickerProps } from './ColourPicker';
import { COLOUR_PICKER_WIDTH, COLOUR_POPOVER_PADDING } from './colour-metrics';

export const COLOUR_POPOVER_WIDTH = COLOUR_PICKER_WIDTH + 2 * COLOUR_POPOVER_PADDING + 2;

export function ColourPopover({
  anchor,
  onClose,
  beside,
  ...picker
}: {
  anchor: HTMLElement;
  onClose: () => void;
  // Open beside this panel (a menu narrower than the picker) rather than under the anchor.
  beside?: HTMLElement | null;
} & ColourPickerProps) {
  const box = useRef<HTMLDivElement>(null);
  // AnchoredPopover focuses its first control once mounted; the picker's own stop is the picked
  // swatch, so it takes focus a frame later.
  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      box.current?.querySelector<HTMLElement>('[data-colour-key][tabindex="0"]')?.focus(),
    );
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <AnchoredPopover
      anchor={anchor}
      name={picker.label}
      width={COLOUR_POPOVER_WIDTH}
      onClose={onClose}
      beside={beside}
    >
      <div
        ref={box}
        className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        style={{ padding: COLOUR_POPOVER_PADDING }}
      >
        <ColourPicker {...picker} />
      </div>
    </AnchoredPopover>
  );
}
