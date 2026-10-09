'use client';

import { useState } from 'react';
import { CheckIcon, Glyph, useMenu, type MenuInitialFocus } from '@livediagram/ui';
import { useHoverCloseTimer } from '@/hooks/ui/useHoverCloseTimer';
import { TOOLBAR_CONTROL_REST } from '@/components/chrome/toolbar-surface';

// The zoom-percentage button in the middle of the ZoomControls dock
// (desktop only — it's hidden below `sm`, like the readout it replaced).
// Clicking it fits the tab's content to the screen; hovering it opens a
// popover above with the preset zoom levels + Fit, so the dock itself
// stays down to three buttons. Options live in a popover rather than
// more dock buttons to keep the corner chrome minimal (same motivation
// as zen mode, docs/specs/007-editor/zen-mode.md).

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
  // How it opened decides focus (docs/specs/004-interface-design/menus.md): a hover asks nothing
  // of the keyboard, so focus stays put; an arrow key on the button moves focus in.
  const [open, setOpen] = useState<MenuInitialFocus | null>(null);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const { cancel: cancelClose, scheduleClose } = useHoverCloseTimer(
    () => setOpen(null),
    CLOSE_DELAY_MS,
  );
  const openNow = (focus: MenuInitialFocus) => {
    cancelClose();
    setOpen((was) => (was === null || focus !== 'none' ? focus : was));
  };

  return (
    <div
      className="relative hidden sm:block"
      // Hover-open is mouse-only: on touch there is no hover, a tap goes
      // straight to the button's click (Fit).
      onPointerEnter={(e) => {
        if (e.pointerType === 'mouse') openNow('none');
      }}
      onPointerLeave={scheduleClose}
      // Focus leaving the cluster (button or an option) closes it; the arrow
      // keys on the button open it.
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) scheduleClose();
      }}
    >
      <button
        ref={setButton}
        type="button"
        onClick={() => {
          setOpen(null);
          onFitToScreen();
        }}
        // The percentage is a button of its own: Enter and Space fit, the arrows open the presets.
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          openNow(e.key === 'ArrowDown' ? 'checked' : 'last');
        }}
        aria-label="Fit to screen"
        aria-haspopup="menu"
        aria-expanded={open !== null}
        className="flex h-9 min-w-[3.5rem] items-center justify-center rounded-md px-2 text-center text-xs font-semibold tabular-nums text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {percent}%
      </button>
      {open !== null ? (
        // Keyed by how it opened: an arrow key on a hover-opened menu remounts it with focus inside.
        <ZoomPresets
          key={open === 'none' ? 'hover' : 'keyboard'}
          percent={percent}
          button={button}
          initialFocus={open}
          onClose={() => setOpen(null)}
          onSetZoom={onSetZoom}
          onFitToScreen={onFitToScreen}
        />
      ) : null}
    </div>
  );
}

function ZoomPresets({
  percent,
  button,
  initialFocus,
  onClose,
  onSetZoom,
  onFitToScreen,
}: {
  percent: number;
  button: HTMLButtonElement | null;
  initialFocus: MenuInitialFocus;
  onClose: () => void;
  onSetZoom: (zoom: number) => void;
  onFitToScreen: () => void;
}) {
  const { attach, surfaceProps } = useMenu({
    onClose,
    trigger: button,
    initialFocus,
    label: 'Zoom level',
  });
  return (
    // pb-2.5 bridges the visual gap so the pointer can travel from
    // the button into the card without leaving the hover area.
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-2.5">
      <div className="relative origin-bottom animate-pop-in">
        <div
          ref={attach}
          {...surfaceProps}
          className="relative flex w-36 flex-col gap-px overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 outline-none ring-1 ring-white/60 backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/95 dark:shadow-slate-950/60 dark:ring-white/5"
        >
          {ZOOM_PRESETS.map((level) => {
            const levelPercent = Math.round(level * 100);
            const active = levelPercent === percent;
            return (
              <button
                key={level}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                tabIndex={-1}
                onClick={() => {
                  onClose();
                  onSetZoom(level);
                }}
                className={`group flex items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums transition ${
                  active
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300'
                    : TOOLBAR_CONTROL_REST
                }`}
              >
                {levelPercent}%{active ? <CheckIcon aria-hidden /> : null}
              </button>
            );
          })}
          <div
            role="separator"
            className="mx-1.5 my-1 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-slate-700"
          />
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onClose();
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
  );
}

// A frame with inset corners — the same fit-to-screen glyph the dock's
// standalone Fit button used to carry.
function FitGlyph() {
  return (
    <Glyph size={13} units={14}>
      <path d="M4.5 1.5H3A1.5 1.5 0 0 0 1.5 3v1.5M9.5 1.5H11A1.5 1.5 0 0 1 12.5 3v1.5M4.5 12.5H3A1.5 1.5 0 0 1 1.5 11V9.5M9.5 12.5H11A1.5 1.5 0 0 0 12.5 11V9.5" />
      <rect
        x="5"
        y="5.5"
        width="4"
        height="3"
        rx="0.75"
        fill="currentColor"
        stroke="none"
        opacity="0.55"
      />
    </Glyph>
  );
}
