// Error card surfaced when an API call FAILS (network down, 5xx) rather
// than legitimately 404s — e.g. the diagram load couldn't reach the
// server, or creating a new diagram never succeeded. Distinct from
// NotFound (which means "this diagram doesn't exist / isn't yours"): a
// failure is retryable, so this card leads with a Retry action. Designed
// to drop into the same chrome as NotFound (EditorHeader above), and
// renders as an absolute overlay so anything behind stays interactive.

import { Button } from '@livediagram/ui';

type ApiErrorPageProps = {
  // Re-attempt the action that failed (reload the editor, retry the
  // create, etc.). Wired by the caller so the same card serves the
  // load-error and create-error paths.
  onRetry: () => void;
  title?: string;
  message?: string;
  retryLabel?: string;
};

export function ApiErrorPage({
  onRetry,
  title = 'Something went wrong',
  message = 'We couldn’t reach the server. Check your connection and try again.',
  retryLabel = 'Try again',
}: ApiErrorPageProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-500/15">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10.3 3.3 1.8 18a1.5 1.5 0 0 0 1.3 2.3h17.8a1.5 1.5 0 0 0 1.3-2.3L13.7 3.3a1.5 1.5 0 0 0-2.6 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Connection error
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{message}</p>
        <Button size="md" onClick={onRetry} className="mt-6 shadow-sm">
          <RetryIcon />
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}

function RetryIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 2v3h-3" />
    </svg>
  );
}
