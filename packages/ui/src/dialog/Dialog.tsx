'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Portal } from '../Portal';
import { useEscape } from '../useEscape';
import { useFocusTrap } from '../useFocusTrap';
import { useSwipeDownDismiss } from '../useSwipeDownDismiss';
import { safeInset } from '../safe-area';

// The shared modal shell (packages/ui, so the public sites use it too; the editor wraps it with its modal
// guard). Every editor dialog (ConfirmDialog,
// TeamFormModal, ShareDialog, Import/Export, Settings, …) re-built the
// same backdrop + centred panel, and they drifted: the backdrop opacity
// flipped between /30 and /40, panel widths ranged across 26rem / 34rem
// / 36rem / 480px with no scale, and Esc / click-outside / SSR-portal
// wiring was re-pasted each time. This owns all of that once.
//
// Deliberately just the chrome (backdrop + panel + dismiss behaviour):
// callers compose their own header / body / footer inside so a form
// dialog, a confirm dialog, and a multi-section dialog can share the
// frame without contorting into a one-size props bag. `size` is the
// width scale; `closeOnEscape` lets a mid-submit dialog suppress Esc.

// Width scale covering the values the hand-rolled dialogs actually used
// (26 / 30 / 34 / 36rem) so every dialog snaps to one rung instead of a
// bespoke `w-[..]`.
export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// The dialogs big enough to be worth the whole phone screen. Below sm: they
// drop their inset, radius and border and fill the viewport — a 92%-wide card
// on a 390px screen wastes the margin twice over and leaves the content
// (share links, theme grids) fighting for room. The small dialogs stay cards:
// a confirm or a rename blown up to full screen reads as a page navigation
// rather than the quick question it is. `md` is in because everything using
// it is a real panel (Settings, Shortcuts, the import / export panes), not a
// question.
const EDGE_TO_EDGE_SIZES = new Set<DialogSize>(['md', 'lg', 'xl', '2xl']);

const WIDTHS: Record<DialogSize, string> = {
  sm: 'w-[26rem]',
  md: 'w-[30rem]',
  lg: 'w-[34rem]',
  xl: 'w-[36rem]',
  // The image picker's two-column grid (640px = 40rem).
  '2xl': 'w-[40rem]',
};

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  // Wires aria-labelledby to the caller's heading element id. Use `ariaLabel`
  // instead when the dialog has no visible heading element to point at.
  titleId?: string;
  ariaLabel?: string;
  size?: DialogSize;
  // Off for dialogs that must not cancel mid-flight (e.g. a submit in
  // progress); defaults on.
  closeOnEscape?: boolean;
  // Extra classes appended to the panel (e.g. `max-h-[90vh]` for a dialog
  // with its own scrolling body).
  className?: string;
  // 'desktop-light' keeps the page visible behind the modal on desktop (a faint tint, no blur) so
  // live effects show through (Settings uses it, so a changed preference shows in the editor
  // behind it). Mobile (below sm) always keeps the full dim: the centred panel covers most of the
  // viewport there anyway, and the dim signals modality.
  backdrop?: 'dim' | 'desktop-light';
  // On a phone (below sm), rise as a sheet docked to the bottom edge, with a grab handle that drags
  // it down to close, instead of filling the screen (docs/specs/007-editor/live-app.md "Working
  // dialogs rise as sheets on a phone"). A centred card from sm up either way.
  phoneSheet?: boolean;
  children: ReactNode;
};

// A phone sheet's panel below sm: the BottomSheet's shape, taller (a dialog holds a form).
const PHONE_SHEET =
  ' max-sm:max-h-[85dvh] max-sm:w-full max-sm:max-w-none max-sm:animate-sheet-up max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:border-b-0';

const BACKDROPS: Record<NonNullable<DialogProps['backdrop']>, string> = {
  dim: 'bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60',
  'desktop-light':
    'bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60 sm:bg-slate-900/10 sm:backdrop-blur-none sm:dark:bg-slate-950/20',
};

export function Dialog({
  open,
  onClose,
  titleId,
  ariaLabel,
  size = 'sm',
  closeOnEscape = true,
  className,
  backdrop = 'dim',
  phoneSheet = false,
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const swipe = useSwipeDownDismiss(onClose);
  // Whether the press now under way began on the backdrop itself.
  const pressedBackdrop = useRef(false);
  // Escape stays bound while open and reads closeOnEscape at the moment of the key: re-binding the listener
  // when it flips would leave a gap (a mid-submit dialog that fails and re-enables Escape) where the key
  // reaches no listener at all.
  const closeOnEscapeRef = useRef(closeOnEscape);
  useLayoutEffect(() => {
    closeOnEscapeRef.current = closeOnEscape;
  }, [closeOnEscape]);
  useEscape(
    () => {
      if (closeOnEscapeRef.current) onClose();
    },
    { enabled: open, preventDefault: true },
  );
  // Trap focus inside the modal while open and hand it back on close — keeps
  // keyboard / screen-reader users out of the inert background. Re-engages on
  // `open` because the dialog stays mounted and toggles rather than unmounting.
  useFocusTrap(panelRef, open);

  if (!open) return null;

  return (
    <Portal>
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          pressedBackdrop.current = e.target === e.currentTarget;
        }}
        // Swallow right-click on the backdrop so neither the browser menu nor
        // the editor's canvas context menu fires behind the modal (several
        // dialogs open-coded this guard before adopting the shell).
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`fixed inset-0 z-[var(--z-modal)] flex items-center justify-center ${
          phoneSheet ? 'max-sm:items-end ' : ''
        }${BACKDROPS[backdrop]}`}
        onClick={(e) => {
          // Only a press that began on the backdrop closes: a text selection dragged out of the
          // panel and released over the backdrop clicks there too, and must not lose the edit.
          if (e.target === e.currentTarget && pressedBackdrop.current) onClose();
          pressedBackdrop.current = false;
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-label={ariaLabel}
          tabIndex={-1}
          style={
            phoneSheet
              ? {
                  paddingBottom: safeInset('bottom'),
                  transform: swipe.offset > 0 ? `translateY(${swipe.offset}px)` : undefined,
                  transition: swipe.dragging
                    ? 'none'
                    : 'transform var(--transition-duration-micro) ease',
                }
              : undefined
          }
          // Default to a viewport-bounded, scrollable panel so a tall dialog on
          // a short/landscape screen never pushes its footer off the bottom.
          // Dialogs that set their own max-h (e.g. ShareDialog, Export) opt out
          // of the default and manage their own scroll region.
          className={`flex ${WIDTHS[size]} max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40${
            phoneSheet
              ? PHONE_SHEET
              : EDGE_TO_EDGE_SIZES.has(size)
                ? ' max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0'
                : ''
          }${
            className?.includes('max-h') ? '' : ' max-h-[calc(100dvh-2rem)] overflow-y-auto'
          }${className ? ` ${className}` : ''}`}
        >
          {phoneSheet ? (
            // The grab handle, phone only: the full width of the sheet, 24px tall (BottomSheet's).
            <div
              aria-hidden
              data-sheet-handle=""
              {...swipe.handleProps}
              className="flex h-6 shrink-0 cursor-grab touch-none items-center justify-center sm:hidden"
            >
              <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </Portal>
  );
}
