'use client';

// What a photo import is doing BEFORE the draft lands (docs/specs/021-event-storming/event-storming.md Phase 8).
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
  // The photo appears the moment detection finishes, so this strip only covers
  // the brief in-browser detection — the words stream in inside the review.
  if (state.stage !== 'detecting') return null;

  return (
    <div
      data-testid="photo-import-progress"
      aria-live="polite"
      // Fixed and out of flow, so nothing on the canvas shifts when it appears
      // or goes (zero CLS) — the same rule as the draft bar it hands off to.
      className="pointer-events-none fixed bottom-20 left-1/2 z-[var(--z-chrome)] -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-4 py-2 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <span
          aria-hidden
          className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-brand-500 dark:border-slate-600 dark:border-t-brand-400"
        />
        <p className="text-[11px] text-slate-600 dark:text-slate-300">Finding the stickies…</p>
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
