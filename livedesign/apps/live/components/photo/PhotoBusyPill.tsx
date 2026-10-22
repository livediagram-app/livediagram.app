'use client';

// A slow photo command at work (lib/photo-editor/photo-busy; docs/specs/031-photo/photo-pages.md "Working on a photo
// page"): a small pill under the palette strip naming it, with a spinner (still for reduced motion), read out once.
import { usePhotoBusy } from '@/lib/photo-editor/photo-busy';

export function PhotoBusyPill({ top }: { top: number }) {
  const label = usePhotoBusy();
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute left-1/2 z-[var(--z-popover)] -translate-x-1/2"
      style={{ top }}
    >
      {label ? (
        <span className="flex animate-fade-in items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-slate-700 shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <span
            aria-hidden
            className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 motion-reduce:animate-none dark:border-brand-500/30 dark:border-t-brand-300"
          />
          {label}
        </span>
      ) : null}
    </div>
  );
}
