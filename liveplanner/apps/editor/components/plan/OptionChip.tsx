'use client';

// A Choice or Multiple Choice option as a chip (docs/specs/026-plan/item-types.md "Choice and Multiple Choice in the
// card panel"): a tint of the option's colour, a dot of the colour itself, the name wrapping rather than overflowing.
// A value that is no longer an option is a grey chip, its tooltip saying so.
import type { CSSProperties } from 'react';
import { Tooltip } from '@liveplanner/ui';
import { TINT_CHIP } from './label-colour';

export const STALE_OPTION_HINT = 'No longer an option';

// The dot and the name, for a chip that draws its own pill (FieldChips).
export function OptionChipBody({ option, colour }: { option: string; colour: string | undefined }) {
  return (
    <>
      <span
        aria-hidden
        className={`size-1.5 shrink-0 rounded-full ${colour ? 'bg-[var(--chip)]' : 'bg-slate-400 dark:bg-slate-500'}`}
      />
      <span className="text-optical-line min-w-0 [overflow-wrap:anywhere]">{option}</span>
      {colour ? null : <span className="sr-only">, {STALE_OPTION_HINT}</span>}
    </>
  );
}

export function OptionChip({
  option,
  colour,
  className = '',
}: {
  option: string;
  colour: string | undefined;
  className?: string;
}) {
  const chip = (
    <span
      data-option-chip=""
      style={colour ? ({ '--chip': colour } as CSSProperties) : undefined}
      className={`inline-flex min-h-6 min-w-0 max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px] font-medium leading-4 max-sm:text-[14px] ${
        colour ? TINT_CHIP : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      } ${className}`}
    >
      <OptionChipBody option={option} colour={colour} />
    </span>
  );
  return colour ? chip : <Tooltip label={STALE_OPTION_HINT}>{chip}</Tooltip>;
}
