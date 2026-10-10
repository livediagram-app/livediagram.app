'use client';

// The one swatch (docs/specs/004-interface-design/colour-picker.md "How it looks"): a 24px target
// holding a 20px rounded square with a hairline border; picked, a brand ring; no colour, a white
// square with a slash. Every colour picker draws its colours with it.
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Tooltip } from '@livediagram/ui';
import { isLightColor } from '@livediagram/document';

type Props = {
  label: string;
  colour: string;
  none?: boolean;
  picked: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label' | 'aria-pressed'>;

export const ColourSwatch = forwardRef<HTMLButtonElement, Props>(function ColourSwatch(
  { label, colour, none = false, picked, className = '', ...button },
  ref,
) {
  return (
    <Tooltip label={label}>
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={picked}
        data-colour-key=""
        className={`group flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        {...button}
      >
        <SwatchChip colour={colour} none={none} picked={picked} />
      </button>
    </Tooltip>
  );
});

/** The chip alone, for a trigger that shows the colour in force. */
export function SwatchChip({
  colour,
  none = false,
  picked = false,
  small = false,
  marked = false,
}: {
  colour: string;
  none?: boolean;
  picked?: boolean;
  // 14px, for a field trigger's leading chip.
  small?: boolean;
  // A corner dot, drawn to contrast with the colour: Quick Style's custom colour in a theme slot.
  marked?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-swatch-chip=""
      style={none ? undefined : { backgroundColor: colour }}
      className={`relative block shrink-0 border border-black/15 transition motion-reduce:transition-none dark:border-white/20 ${
        small ? 'h-3.5 w-3.5 rounded-[4px]' : 'h-5 w-5 rounded-[5px]'
      } ${none ? 'overflow-hidden bg-white' : ''} ${
        picked
          ? 'ring-2 ring-brand-500 ring-offset-1 dark:ring-brand-300 dark:ring-offset-slate-900'
          : 'group-hover:scale-110 motion-reduce:group-hover:scale-100'
      }`}
    >
      {none ? (
        <span className="absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-slate-400" />
      ) : null}
      {marked ? (
        <span
          data-swatch-marker=""
          className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ring-1 ${
            isLightColor(colour) ? 'bg-slate-900 ring-white' : 'bg-white ring-slate-900'
          }`}
        />
      ) : null}
    </span>
  );
}
