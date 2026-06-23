'use client';

// The only chrome the read-only embed view renders (spec/33): the
// bottom-left "Open in livediagram" badge that links out to the full
// share view, plus a tab switcher next to it (only when the diagram
// has more than one tab). Bottom-left specifically because the
// ZoomControls dock keeps bottom-right in embeds. Pointer events stop
// here so clicks don't fall through to the canvas underneath.
//
// The tab switcher is a compact hamburger button showing the current
// tab; tapping it opens a dropdown ABOVE listing the tabs. A fixed-width
// button (rather than a horizontal row of pills) keeps the chrome from
// stretching across the canvas and colliding with the zoom dock when a
// diagram has many tabs.

import { useRef, useState } from 'react';
import type { Tab } from '@livediagram/diagram';
import { useClickOutside } from '@/hooks/ui/useClickOutside';
import { useEscape } from '@/hooks/ui/useEscape';

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

function MenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 3h8M2 6h8M2 9h8" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 4.5 6 7.5l3-3" />
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);
  useEscape(() => setMenuOpen(false));

  const activeName = tabs.find((t) => t.id === activeId)?.name ?? 'Tab';

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-30 flex items-center gap-2"
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
        <div ref={menuRef} className="pointer-events-auto relative">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex max-w-[44vw] items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 shadow-sm transition hover:bg-white hover:text-slate-900 dark:bg-slate-900/90 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            <MenuIcon />
            <span className="min-w-0 truncate">{activeName}</span>
            <ChevronIcon />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="absolute bottom-full left-0 mb-1 flex max-h-[50vh] w-44 max-w-[60vw] flex-col overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
            >
              {tabs.map((t) => {
                const active = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      onSelectTab(t.id);
                      setMenuOpen(false);
                    }}
                    className={
                      'truncate px-3 py-1.5 text-left text-[11px] font-medium transition ' +
                      (active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
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
      ) : null}
    </div>
  );
}
