'use client';

import { useRef, type ReactNode } from 'react';
import { Portal } from '@/components/primitives/Portal';
import { useEscape } from '@/hooks/ui/useEscape';
import { useFocusTrap } from '@/hooks/ui/useFocusTrap';
import { useModalGuard } from '@/hooks/ui/useModalGuard';

// The shared modal shell. Every editor dialog (ConfirmDialog,
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
type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

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
  // 'desktop-light' keeps the page visible behind the modal on desktop (a
  // faint tint, no blur) so live effects show through — the edit-favourites
  // dialog uses it so the palette grid updates in view (spec/78). Mobile
  // (below sm) always keeps the full dim: the centred panel covers most of
  // the viewport there anyway, and the dim signals modality.
  backdrop?: 'dim' | 'desktop-light';
  children: ReactNode;
};

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
  children,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Register with the modal guard so the editor's window-level shortcut
  // and paste listeners go quiet while any dialog is up (they otherwise
  // mutate the canvas behind the modal — see lib/modal-guard).
  useModalGuard(open);
  useEscape(onClose, { enabled: open && closeOnEscape, preventDefault: true });
  // Trap focus inside the modal while open and hand it back on close — keeps
  // keyboard / screen-reader users out of the inert background. Re-engages on
  // `open` because the dialog stays mounted and toggles rather than unmounting.
  useFocusTrap(panelRef, open);

  if (!open) return null;

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        // Swallow right-click on the backdrop so neither the browser menu nor
        // the editor's canvas context menu fires behind the modal (several
        // dialogs open-coded this guard before adopting the shell).
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className={`fixed inset-0 z-[var(--z-modal)] flex items-center justify-center ${BACKDROPS[backdrop]}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-label={ariaLabel}
          tabIndex={-1}
          // Default to a viewport-bounded, scrollable panel so a tall dialog on
          // a short/landscape screen never pushes its footer off the bottom.
          // Dialogs that set their own max-h (e.g. ShareDialog, Export) opt out
          // of the default and manage their own scroll region.
          className={`flex ${WIDTHS[size]} max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40${
            className?.includes('max-h') ? '' : ' max-h-[calc(100dvh-2rem)] overflow-y-auto'
          }${className ? ` ${className}` : ''}`}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
