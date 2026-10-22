// A small nudge that floats above the zoom dock when every element on the
// tab has scrolled out of view (see useOffscreenContent). It both tells the
// user what happened and offers a one-click way back, so they don't have to
// hunt for the Fit button below it. Rendered by CanvasChrome inside the
// bottom-right dock container; positioned above it with `bottom-full`.

import { Button } from '@livediagram/ui';

type OffscreenContentHintProps = {
  // Bring everything back into view (wired to fit-to-screen).
  onBringBack: () => void;
};

export function OffscreenContentHint({ onBringBack }: OffscreenContentHintProps) {
  return (
    <div
      role="status"
      onPointerDown={(e) => e.stopPropagation()}
      className="pointer-events-auto absolute bottom-full right-0 mb-2 flex w-56 animate-pop-in flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40"
    >
      <p className="text-xs font-semibold text-slate-700 dark:text-slate-100">Nothing’s in view</p>
      <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
        Everything on this tab has scrolled off-screen.
      </p>
      <Button size="xs" onClick={onBringBack} className="mt-0.5">
        Bring it back into view
      </Button>
      {/* Caret pointing down toward the zoom dock / Fit button below. */}
      <div className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />
    </div>
  );
}
