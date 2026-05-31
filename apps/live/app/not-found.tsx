// Custom 404 page for routes inside `/live/*` that don't match any
// build-time entry. Without this, Next.js's default `_not-found` HTML
// ships as a bare white card with `404 / This page could not be
// found.` — which reads as a framework default and not part of the
// app. The Cloudflare Static Assets binding serves THIS file (built
// to `out/404.html`) thanks to `not_found_handling = "404-page"` in
// `wrangler.toml`.
//
// Mirrors the look of the in-app `<NotFound>` card (the diagram-not-
// found state) so a user typing `/live/diagrams` or any other dead
// link lands somewhere familiar with a way back into the editor.

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-slate-200 bg-white px-8 py-10 text-center shadow-lg shadow-slate-900/10">
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
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          The page you&apos;re looking for doesn&apos;t exist. Try opening a diagram from the
          Explorer or starting a fresh one.
        </p>
        <Link
          href="/new"
          className="mt-6 inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
        >
          <SparkleIcon />
          Create a new diagram
        </Link>
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
