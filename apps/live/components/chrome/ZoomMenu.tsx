'use client';

import { useRef, useState } from 'react';

// The zoom-percentage button in the middle of the ZoomControls dock
// (desktop only — it's hidden below `sm`, like the readout it replaced).
// Clicking it fits the tab's content to the screen; hovering it opens a
// popover above with the preset zoom levels + Fit, so the dock itself
// stays down to three buttons. Options live in a popover rather than
// more dock buttons to keep the corner chrome minimal (same motivation
// as zen mode, spec/26).

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.25, 1.5];

// Grace period before the popover closes once the pointer leaves the
// button + popover column, so a diagonal move to an option doesn't
// dismiss it mid-travel.
const CLOSE_DELAY_MS = 120;

type ZoomMenuProps = {
  zoom: number;
  onSetZoom: (zoom: number) => void;
  onFitToScreen: () => void;
};

export function ZoomMenu({ zoom, onSetZoom, onFitToScreen }: ZoomMenuProps) {
  const percent = Math.round(zoom * 100);
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  return (
    <div
      className="relative hidden sm:block"
      // Hover-open is mouse-only: on touch there is no hover, a tap goes
      // straight to the button's click (Fit).
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') openNow();
      }}
      onPointerLeave={scheduleClose}
      // Keyboard path: the popover opens while focus is anywhere inside
      // the cluster (button or an option) and closes when it leaves.
      onFocus={openNow}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) scheduleClose();
      }}
    >
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          onFitToScreen();
        }}
        aria-label="Fit to screen"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 min-w-[3.5rem] items-center justify-center rounded-md px-2 text-center text-xs font-semibold tabular-nums text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {percent}%
      </button>
      {open ? (
        // pb-2.5 bridges the visual gap so the pointer can travel from
        // the button into the card without leaving the hover area.
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2.5">
          <div className="relative origin-bottom animate-pop-in">
            <div
              role="menu"
              aria-label="Zoom level"
              className="relative flex w-36 flex-col gap-px overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 ring-1 ring-white/60 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-slate-950/60 dark:ring-white/5"
            >
              {ZOOM_PRESETS.map((level) => {
                const levelPercent = Math.round(level * 100);
                const active = levelPercent === percent;
                return (
                  <button
                    key={level}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      onSetZoom(level);
                    }}
                    className={`group flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums transition ${
                      active
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                    }`}
                  >
                    {levelPercent}%{active ? <CheckGlyph /> : null}
                  </button>
                );
              })}
              <div
                className="mx-1.5 my-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700"
                aria-hidden
              />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onFitToScreen();
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <FitGlyph />
                Fit to screen
              </button>
            </div>
            {/* Caret pointing back at the percentage button. */}
            <div
              aria-hidden
              className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 rounded-[2px] border-b border-r border-slate-200/80 bg-white/95 dark:border-slate-700/80 dark:bg-slate-900/95"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      <path
        d="M2.5 6.5 5 9l4.5-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// A frame with inset corners — the same fit-to-screen glyph the dock's
// standalone Fit button used to carry.
function FitGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
      <path
        d="M4.5 1.5H3A1.5 1.5 0 0 0 1.5 3v1.5M9.5 1.5H11A1.5 1.5 0 0 1 12.5 3v1.5M4.5 12.5H3A1.5 1.5 0 0 1 1.5 11V9.5M9.5 12.5H11A1.5 1.5 0 0 0 12.5 11V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="5" y="5.5" width="4" height="3" rx="0.75" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
