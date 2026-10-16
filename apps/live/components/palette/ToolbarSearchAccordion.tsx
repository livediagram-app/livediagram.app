'use client';

import { useId, type ReactNode } from 'react';
import { ChevronIcon } from '@/components/primitives/ChevronIcon';

// One of the Toolbar strip's Search accordions under this mode's results
// (docs/specs/007-editor/toolbar-layout.md "Search: every element type"): a titled, counted header
// that shows its tiles when opened. Closed by default; the panel holds whether it is open.
export function ToolbarSearchAccordion({
  title,
  description,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <div className="flex flex-col border-t border-slate-100 pt-2 dark:border-slate-800">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
        className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition ${
          open
            ? 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60'
            : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              {title}
            </span>
            <span className="inline-flex h-[12.6px] shrink-0 items-center rounded-full bg-slate-100 px-1.5 text-[9px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <span className="text-optical-centre">{count}</span>
            </span>
          </span>
          <span className="line-clamp-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
            {description}
          </span>
        </span>
        <span className="shrink-0 text-slate-400">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open ? (
        <div id={bodyId} className="mt-1.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}
