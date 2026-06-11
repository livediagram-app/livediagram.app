'use client';

// The only chrome the read-only embed view renders (spec/33): the
// bottom-left "Open in livediagram" badge that links out to the full
// share view, plus a tab switcher next to it (only when the diagram
// has more than one tab). Bottom-left specifically because the
// ZoomControls dock keeps bottom-right in embeds. Pointer events stop
// here so clicks don't fall through to the canvas underneath.

import type { Tab } from '@livediagram/diagram';

function OpenExternalIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 2H2.5A.5.5 0 0 0 2 2.5v7a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V7" />
      <path d="M7 2h3v3M10 2 5.5 6.5" />
    </svg>
  );
}

type EmbedChromeProps = {
  tabs: Pick<Tab, 'id' | 'name'>[];
  activeId: string;
  onSelectTab: (id: string) => void;
  // The session's share code; the badge links to the full share view
  // for the same code. Null only in degenerate states (the embed
  // route always arrives via ?s=); the badge then falls back to the
  // app root so it never renders a dead link.
  shareCode: string | null;
};

export function EmbedChrome({ tabs, activeId, onSelectTab, shareCode }: EmbedChromeProps) {
  const openUrl = shareCode ? `/diagram/shared?s=${encodeURIComponent(shareCode)}` : '/new';
  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-30 flex max-w-[calc(100vw-8rem)] items-center gap-2"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <a
        href={openUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-900 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
      >
        <OpenExternalIcon />
        Open in livediagram
      </a>
      {tabs.length > 1 ? (
        <div className="pointer-events-auto flex min-w-0 items-center gap-1 overflow-x-auto rounded-full bg-white/90 p-1 shadow-sm dark:bg-slate-900/90">
          {tabs.map((t) => {
            const active = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTab(t.id)}
                className={
                  'whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition ' +
                  (active
                    ? 'bg-brand-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                {t.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
