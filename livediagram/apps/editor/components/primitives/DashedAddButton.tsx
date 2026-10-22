'use client';

// The full-width dashed "add" row (docs/specs/026-plan/item-types.md "The Card Types panel",
// docs/specs/007-editor/logo-pages.md "Logo layouts"): a plus and the label, quiet until hovered,
// when it takes the brand colour. Add New Card Type and Start From Scratch both wear it. Its border and text
// default to the chrome's; a host may pass its own (`tone`) through CSS variables.
import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { PlusIcon } from '@livediagram/ui';

const BASE =
  'flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-3 py-2 text-[13px] font-medium transition hover:border-brand-400 hover:bg-brand-50/60 hover:text-brand-700 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/10 dark:hover:text-brand-300';
// A host's colours through variables, so the hover classes win over them.
const TONED = 'border-[var(--line)] text-[var(--muted)]';
const IN_CHROME = 'border-slate-300 text-slate-500 dark:border-slate-600 dark:text-slate-400';

export function DashedAddButton({
  label,
  tone,
  className = '',
  style,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label: string;
  // The host's border and text colours (a Plan board's), else the chrome's.
  tone?: { line: string; muted: string };
}) {
  return (
    <button
      type="button"
      {...rest}
      className={`${BASE} ${tone ? TONED : IN_CHROME} ${className}`}
      style={
        tone ? ({ ...style, '--line': tone.line, '--muted': tone.muted } as CSSProperties) : style
      }
    >
      <PlusIcon size={12} />
      {label}
    </button>
  );
}
