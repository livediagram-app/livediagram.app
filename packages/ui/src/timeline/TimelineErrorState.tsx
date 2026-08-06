'use client';

// "We couldn't read the feed" — deliberately NOT the empty state
// (spec/138 §2.4).
//
// The feed used to render a failed read as "Nothing has happened yet",
// which is a lie told to exactly the people it upsets most: someone
// returning to a sleeping laptop, whose session token or connection
// lapsed, and whose history is entirely intact on the server. The only
// way to find out was a browser refresh.
//
// Lives in the package rather than in the Explorer's panel folder
// because every host of <Timeline> — the landing feed, a team's
// activity card, one diagram's history — can fail the same way and
// should say so the same way.

export function TimelineErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-dashed border-slate-200 px-6 py-10 text-center dark:border-slate-700"
    >
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
        Couldn&rsquo;t load your timeline
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Your history is safe. Check your connection and try again.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}
