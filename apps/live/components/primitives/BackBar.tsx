'use client';

// A full-width "go back to the overview" bar. Far more obvious than a small
// pill in the corner: the whole row is the target. One bar for every
// two-level browse (themes, templates, the custom theme builder, folder
// placement) so they all read the same. When it mounts it eases into place
// (slide-row-in: fade, a short slide, and height from zero) rather than
// popping in and shoving the rows beneath it down.
//
// Without `onClick` there is nowhere to go back to, and the bar becomes a
// static heading in the same shape ("Choose a Space"): a browse that keeps
// the bar at every level never has it appear and disappear under the rows.

const SHELL =
  'mb-3 flex w-full animate-slide-row-in items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const WELL =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200';

export function BackBar({
  label,
  current,
  onClick,
}: {
  label: string;
  // The category the user has drilled into, shown as a chip on the right
  // so it's clear which group they're in (and which their selection is).
  current?: string;
  // Absent = the static heading form.
  onClick?: () => void;
}) {
  const chip = current ? (
    <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
      {current}
    </span>
  ) : null;
  if (!onClick) {
    return (
      <div className={SHELL}>
        <span className={WELL}>
          <DotsGlyph />
        </span>
        {label}
        {chip}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group ${SHELL} transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/80 dark:hover:text-brand-200`}
    >
      <span
        className={`${WELL} transition group-hover:bg-brand-100 group-hover:text-brand-700 dark:group-hover:bg-brand-500/25 dark:group-hover:text-brand-200`}
      >
        <ChevronGlyph />
      </span>
      {label}
      {chip}
    </button>
  );
}

function ChevronGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className="transition-transform duration-150 group-hover:-translate-x-0.5"
    >
      <path
        d="M7.5 2.5 4 6l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Four dots: the choices below, rather than a way back.
function DotsGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" aria-hidden>
      <circle cx="3.5" cy="3.5" r="1.4" fill="currentColor" />
      <circle cx="8.5" cy="3.5" r="1.4" fill="currentColor" />
      <circle cx="3.5" cy="8.5" r="1.4" fill="currentColor" />
      <circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
