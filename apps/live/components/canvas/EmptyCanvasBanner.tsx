'use client';

import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';

// Empty-canvas hint (spec/14). A subdued bottom banner shown while the active
// tab has no elements — replacing the old centre-of-canvas card so the hint
// stays unobtrusive (a truly blank diagram reads as blank, not as a
// half-finished modal). Not dismissible: it simply goes away once the canvas
// has content (or a draw tool / Quick Start is engaged). Sits in the same
// bottom slot as the sign-in / theme banners; the host (EditorView) decides
// visibility + which banner wins the slot. For editors it offers a Quick Start
// (template grid) button; viewers get a passive "nothing here yet" line instead
// (they can't add content).

export function EmptyCanvasBanner({
  tabName,
  readOnly,
  onQuickStart,
  placementClassName = 'bottom-0 z-40 pb-16',
}: {
  tabName: string;
  readOnly: boolean;
  onQuickStart: () => void;
  placementClassName?: string;
}) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 flex justify-center px-4 ${placementClassName}`}
    >
      <div className="pointer-events-auto flex w-full max-w-xl animate-fly-up-in items-center gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-lg shadow-slate-900/5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-500 sm:flex dark:bg-brand-500/15">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="6" width="10" height="10" rx="1.5" />
            <circle cx="16" cy="14" r="5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {tabName} is empty
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {readOnly
              ? 'Nothing here yet — the owner can build it out, and your view updates live.'
              : 'Add an element from the Palette, or start from a template.'}
          </p>
        </div>
        {readOnly ? null : (
          <div className="flex shrink-0 items-center gap-2">
            <HelpArticleLink
              article="yourFirstDiagram"
              title="Your first diagram"
              description="A short walkthrough of building your first diagram."
            />
            <button
              type="button"
              onClick={onQuickStart}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
            >
              Quick Start
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
