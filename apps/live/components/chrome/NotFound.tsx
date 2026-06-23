// 404 card surfaced when the URL points at a diagram that doesn't
// exist OR isn't owned by the current participant. The API returns
// 404 for both (we don't leak existence to strangers). The card is
// designed to drop into the same chrome as /live/new — EditorHeader
// above + Explorer panel overlay — so the caller composes the page
// layout. Renders as an absolute overlay so the Explorer behind
// stays interactive.

type NotFoundProps = {
  onCreateNew: () => void;
};

export function NotFound({ onCreateNew }: NotFoundProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="pointer-events-auto flex max-w-md animate-pop-in flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300">
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
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6M9 15l6-6" />
          </svg>
        </div>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-300">
          404
        </p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Diagram not found
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          This diagram doesn&apos;t exist or isn&apos;t yours. Open one from the Explorer or start
          fresh.
        </p>
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
        >
          <SparkleIcon />
          Create a new diagram
        </button>
      </div>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.4 3.1L12.5 7l-3.1 1.4L8 11.5 6.6 8.4 3.5 7l3.1-1.4z" />
      <path d="M12.5 11.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" />
    </svg>
  );
}
