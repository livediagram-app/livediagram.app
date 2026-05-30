// Full-screen 404 surfaced when the URL points at a diagram that
// doesn't exist OR isn't owned by the current participant. The
// API returns 404 for both cases (we don't leak existence to
// strangers); the UI offers a single "Create new diagram" CTA that
// navigates to `/live` without a `?d=` so the welcome flow kicks in.

type NotFoundProps = {
  onCreateNew: () => void;
};

export function NotFound({ onCreateNew }: NotFoundProps) {
  return (
    <div className="flex flex-1 items-center justify-center bg-slate-50">
      <div className="flex max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-500">
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
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-rose-600">404</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Diagram not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          We couldn&apos;t find a diagram at this URL. It may have been deleted, or it might belong
          to someone else. If a teammate sent it, ask them for the share link instead.
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
