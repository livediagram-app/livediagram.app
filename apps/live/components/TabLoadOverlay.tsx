'use client';

import { ApiErrorPage } from './ApiErrorPage';

// Blocking overlay shown over the canvas while the ACTIVE tab's content
// is still being fetched (spec/13 lazy per-tab load), or after that
// fetch failed. It must BLOCK interaction rather than just decorate, for
// two reasons:
//   1. Until the GET lands, local state holds an empty-elements
//      placeholder. Without this overlay the user sees the "Empty
//      canvas" prompt and assumes their diagram was lost.
//   2. If they then add an element to that placeholder, the autosave
//      persists the empty-plus-new tab and WIPES the real server row.
//      An opaque, pointer-capturing backdrop makes that impossible.
// It renders as the last child of the canvas <main> (which is
// `relative`), so `absolute inset-0` covers the whole surface including
// the floating palette. The header + TabBar live outside <main>, so they
// stay live — the user can still switch tabs or navigate away.
export function TabLoadOverlay({
  state,
  onRetry,
}: {
  state: 'loading' | 'error';
  onRetry: () => void;
}) {
  if (state === 'error') {
    // The opaque backdrop both hides the misleading empty canvas behind
    // it and captures pointer events (default pointer-events: auto), so
    // clicks can't reach the palette / canvas. ApiErrorPage supplies the
    // card + Retry on top.
    return (
      <div className="absolute inset-0 z-50 bg-slate-50 dark:bg-slate-950">
        <ApiErrorPage
          onRetry={onRetry}
          title="Couldn’t load this tab"
          message="We couldn’t reach the server to load this tab’s contents. Your work is safe. Check your connection and try again."
          retryLabel="Retry"
        />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-col items-center gap-3">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="animate-spin text-brand-500"
          aria-hidden
        >
          <circle cx="16" cy="16" r="12" strokeOpacity="0.18" />
          <path d="M28 16a12 12 0 0 0-12-12" />
        </svg>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Loading tab…</p>
      </div>
    </div>
  );
}
