'use client';

import { Glyph } from './icons';

// liveplanner's BackBar (components/primitives/BackBar.tsx): a full-width "go back" bar, the whole row the target,
// with the place open here as a chip at its right. The editor's Explorer pane puts it over an open folder. It is
// sticky, so the way back stays pinned however far the rows below scroll, and lifts itself by its scroller's top
// padding so it sits flush with the scroller's edge.

const SHELL =
  'sticky top-0 z-10 flex w-full animate-slide-row-in items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
const WELL =
  'flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-200';

export function BackBar({
  label,
  current,
  onClick,
  gap = 'default',
}: {
  label: string;
  current?: string;
  onClick: () => void;
  gap?: 'default' | 'tight';
}) {
  return (
    <button
      ref={stickToScrollerEdge}
      type="button"
      onClick={onClick}
      className={`group ${gap === 'tight' ? 'mb-1.5' : 'mb-3'} ${SHELL} cursor-pointer transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/80 dark:hover:text-brand-200`}
    >
      <span
        className={`${WELL} transition group-hover:bg-brand-100 group-hover:text-brand-700 dark:group-hover:bg-brand-500/25 dark:group-hover:text-brand-200`}
      >
        <Glyph
          size={13}
          units={12}
          className="transition-transform duration-micro group-hover:-translate-x-0.5"
        >
          <path d="M7.5 2.5 4 6l3.5 3.5" />
        </Glyph>
      </span>
      {label}
      {current ? (
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          {current}
        </span>
      ) : null}
    </button>
  );
}

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
