'use client';

import { Button } from '@livediagram/ui';

// "New to livediagram?" card (spec/69): the guided tour's home on the /new
// screen, sitting in the right rail under Jump Back In and styled to match.
// The tour used to pose as a template card inside the Quick Start grid, but
// it isn't a real template, so it gets its own affordance instead. One click
// commits the guided-tour sample (created offline, spec/76) and lands the
// user on a living canvas.
export function NewHereCard({ onStart, busy }: { onStart: () => void; busy: boolean }) {
  return (
    <div className="pointer-events-auto w-64 rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 ring-1 ring-black/5 transition duration-200 hover:-translate-y-0.5 hover:shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40">
      <div className="flex items-center gap-2 rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-brand-50 to-transparent px-4 py-3 dark:border-slate-800 dark:from-brand-500/10">
        <SparkIcon />
        <div className="flex flex-col">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            New to livediagram?
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">Learn by example</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Start with a sample diagram that walks you through the basics: shapes, arrows, tabs, and
          the palette.
        </p>
        {/* rounded-lg + py-2 keep the card's taller CTA shape; the classes
            append after the size scale, so they win. */}
        {/* CTA renamed from "Show me around": that name now belongs to the
            interactive editor tour (spec/79). */}
        <Button size="xs" onClick={onStart} disabled={busy} className="rounded-lg py-2 shadow-sm">
          Take the guided tour
        </Button>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0 text-brand-500 dark:text-brand-400"
    >
      <path d="M8 2.5c.4 2.2 1.3 3.1 3.5 3.5C9.3 6.4 8.4 7.3 8 9.5 7.6 7.3 6.7 6.4 4.5 6 6.7 5.6 7.6 4.7 8 2.5Z" />
      <path d="M12.5 9.5c.2 1 .6 1.4 1.5 1.5-.9.2-1.3.6-1.5 1.5-.2-.9-.6-1.3-1.5-1.5.9-.1 1.3-.5 1.5-1.5Z" />
    </svg>
  );
}
