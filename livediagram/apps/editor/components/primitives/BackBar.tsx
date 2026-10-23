'use client';

import { Glyph } from '@livediagram/ui';

// A full-width "go back to the overview" bar. Far more obvious than a small
// pill in the corner: the whole row is the target. One bar for every
// two-level browse (themes, templates, folder
// placement) so they all read the same. When it mounts it eases into place
// (slide-row-in: fade, a short slide, and height from zero) rather than
// popping in and shoving the rows beneath it down.
//
// Without `onClick` there is nowhere to go back to, and the bar becomes a
// static heading in the same shape ("Choose a Space"): a browse that keeps
// the bar at every level never has it appear and disappear under the rows.
//
// It is sticky: however far the rows below scroll (a long list of colours on
// a phone), the way back stays pinned to the top of the scroll area. Its host
// must not clip with `overflow: hidden` between the bar and the scroller (that
// makes its own scroll box and pins the bar to it); `overflow-clip` does not.
// Sticky pins below the scroller's top padding, which would leave a strip the
// rows show through above the bar, so the bar lifts itself by that padding
// (stickToScrollerEdge) and sits flush with the scroller's edge in any host.

const SHELL =
  'sticky top-0 z-10 flex w-full animate-slide-row-in items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const WELL =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200';

export function BackBar({
  label,
  current,
  onClick,
  gap = 'default',
  disabled = false,
}: {
  label: string;
  // The category the user has drilled into, shown as a chip on the right
  // so it's clear which group they're in (and which their selection is).
  current?: string;
  // Absent = the static heading form.
  onClick?: () => void;
  // Space below the bar. `tight` for a list of rows directly under it (the
  // placement browser), where the default read as a gap in the list.
  gap?: 'default' | 'tight';
  // Greys the bar out and stops it firing, for a step that is mid-flight
  // (the import panel while an import runs). It stays the button form rather
  // than falling back to the static heading, so the row does not swap glyph
  // and shape for the second the work takes.
  disabled?: boolean;
}) {
  const shell = `${gap === 'tight' ? 'mb-1.5' : 'mb-3'} ${SHELL}`;
  const chip = current ? (
    <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
      {current}
    </span>
  ) : null;
  if (!onClick) {
    return (
      <div ref={stickToScrollerEdge} className={shell}>
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
      ref={stickToScrollerEdge}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group ${shell} transition disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:border-brand-300 enabled:hover:bg-brand-50/50 enabled:hover:text-brand-700 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-slate-800/80 dark:enabled:hover:text-brand-200`}
    >
      <span
        className={`${WELL} transition group-enabled:group-hover:bg-brand-100 group-enabled:group-hover:text-brand-700 dark:group-enabled:group-hover:bg-brand-500/25 dark:group-enabled:group-hover:text-brand-200`}
      >
        <ChevronGlyph />
      </span>
      {label}
      {chip}
    </button>
  );
}

// Sets the bar's sticky `top` to minus its scroll box's top padding, read once as it mounts (a walk up a few
// ancestors; the padding is fixed per host). The scroll box is the first ancestor that does not let overflow through:
// a `hidden` one (a capped AnimatedHeightBox before it overflows) keeps `top: 0`, as does having none.
function stickToScrollerEdge(el: HTMLElement | null) {
  if (!el) return;
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY, paddingTop } = getComputedStyle(p);
    if (overflowY === 'visible' || overflowY === 'clip') continue;
    if (overflowY === 'auto' || overflowY === 'scroll')
      el.style.top = `${-(parseFloat(paddingTop) || 0)}px`;
    return;
  }
}

function ChevronGlyph() {
  return (
    <Glyph
      size={13}
      units={12}
      className="transition-transform duration-micro group-enabled:group-hover:-translate-x-0.5"
    >
      <path d="M7.5 2.5 4 6l3.5 3.5" />
    </Glyph>
  );
}

// Four dots: the choices below, rather than a way back.
function DotsGlyph() {
  return (
    <Glyph size={13} units={12} filled>
      <circle cx="3.5" cy="3.5" r="1.4" />
      <circle cx="8.5" cy="3.5" r="1.4" />
      <circle cx="3.5" cy="8.5" r="1.4" />
      <circle cx="8.5" cy="8.5" r="1.4" />
    </Glyph>
  );
}
