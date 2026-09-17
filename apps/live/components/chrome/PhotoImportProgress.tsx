'use client';

// What a photo import is doing BEFORE the draft lands (spec/139 Phase 8).
//
// The first version showed NOTHING between the file picker and the draft bar:
// the author picked a photo and stared at an unmoving board for however long
// detection and reading took, with no way to tell it was alive. This appears
// the instant the file is selected and walks through the two phases — finding
// the stickies, then reading their words, with a count — until the draft
// replaces it. Cancel is right there for both.
//
// Same slot and visual language as PhotoDraftBar, because the two are the same
// strip at different moments of one gesture and never show at once.

import type { PhotoDraftState } from '@/hooks/canvas/usePhotoDraft';

export function PhotoImportProgress({
  state,
  onCancel,
}: {
  state: PhotoDraftState;
  onCancel: () => void;
}) {
  if (state.stage !== 'detecting' && state.stage !== 'reading') return null;

  const reading = state.stage === 'reading';
  const progress =
    reading && state.found > 0 ? Math.min(1, state.readSoFar / state.found) : null;

  return (
    <div
      data-testid="photo-import-progress"
      aria-live="polite"
      // Fixed and out of flow, so nothing on the canvas shifts when it appears
      // or goes (zero CLS) — the same rule as the draft bar it hands off to.
      className="pointer-events-none fixed bottom-20 left-1/2 z-[var(--z-chrome)] -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 dark:border-slate-600 dark:border-t-brand-400" />
        <div className="min-w-0">
          <p className="text-[11px] text-slate-600 dark:text-slate-300">
            {reading
              ? `Reading the words · ${state.readSoFar} of ${state.found}`
              : 'Finding the stickies…'}
          </p>
          {progress !== null ? (
            <span className="mt-1 block h-1 w-56 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <span
                className="block h-full rounded-full bg-brand-500 transition-[width] duration-300"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
