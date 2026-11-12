'use client';

// What the Import dialog's body shows while a file is dragged over it, on any step (plan-tabs.md "The Import
// dialog"): a dashed outline and Drop to Import, over what the step shows.
import { lucideGlyph } from '@liveplanner/ui';
import { lucideFileDown } from '@liveworkspace/icons/lucide';

const DropIcon = lucideGlyph(lucideFileDown, 22);

export function DropOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-400 bg-white/90 text-brand-700 animate-fade-in dark:border-brand-500/70 dark:bg-slate-900/90 dark:text-brand-200"
    >
      <DropIcon />
      <span className="text-sm font-semibold">Drop to Import</span>
    </div>
  );
}
