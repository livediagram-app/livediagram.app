'use client';

// A small card under a control, shown while it is hovered or focused: its name and a line on what it does.
// Pure CSS (group-hover / group-focus-within), so it costs nothing until shown; the control keeps its own
// aria-label, and the card is its description for assistive technology.

import { useId, type ReactElement, cloneElement } from 'react';

export function HoverCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
}) {
  const id = useId();
  return (
    <span className="group/hc relative inline-flex">
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute right-0 top-full z-40 mt-1.5 hidden w-52 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left shadow-lg group-hover/hc:block group-focus-within/hc:block dark:border-slate-700 dark:bg-slate-800"
      >
        <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
          {description}
        </span>
      </span>
    </span>
  );
}
