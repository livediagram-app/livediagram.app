'use client';

import type { ReactNode } from 'react';
import { HoverCard } from '@livedesign/ui';

// The Inspect panel's building blocks (docs/specs/007-editor/wireframe-pages.md "The Inspect panel"): a titled
// section, and a value cell that copies on a press.

export function InspectSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** One value: its name over it, a swatch beside a colour, "Copied" flashed on it once copied. */
export function InspectValueCell({
  name,
  value,
  swatch,
  wide = false,
  copied,
  onCopy,
}: {
  name: string;
  value: string;
  // A colour to show beside the value; null for a part painted with none (an empty, struck swatch).
  swatch?: string | null;
  // Spans both columns of a two-column grid (a font's name).
  wide?: boolean;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <HoverCard
      title={`Copy ${name}`}
      description={`Copies ${value}.`}
      block
      className={wide ? 'col-span-2' : undefined}
    >
      <button
        type="button"
        onClick={onCopy}
        aria-label={`${name}: ${value}. Copy`}
        className="group flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-left transition hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 active:bg-brand-100 dark:bg-slate-800/60 dark:hover:bg-brand-500/15"
      >
        {swatch !== undefined ? <Swatch colour={swatch} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] leading-tight text-slate-500 dark:text-slate-400">
            {name}
          </span>
          <span
            className={`block truncate font-mono text-xs leading-snug tabular-nums ${
              copied
                ? 'text-brand-700 dark:text-brand-200'
                : 'text-slate-800 group-hover:text-brand-800 dark:text-slate-100 dark:group-hover:text-brand-100'
            }`}
          >
            {copied ? 'Copied' : value}
          </span>
        </span>
      </button>
    </HoverCard>
  );
}

function Swatch({ colour }: { colour: string | null }) {
  return (
    <span
      aria-hidden
      className="relative h-5 w-5 shrink-0 overflow-hidden rounded border border-slate-300 dark:border-slate-600"
      style={colour ? { background: colour } : undefined}
    >
      {colour ? null : (
        // None: a clear swatch struck through, as colour pickers draw "no colour".
        <span className="absolute left-1/2 top-[-2px] h-[26px] w-px origin-center rotate-45 bg-rose-500" />
      )}
    </span>
  );
}
