'use client';

import type { ReactNode } from 'react';
import { Portal } from './Portal';
import { useEscape } from '@/hooks/useEscape';

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

type DialogSize = 'sm' | 'md' | 'lg';

const WIDTHS: Record<DialogSize, string> = {
  sm: 'w-[26rem]',
  md: 'w-[32rem]',
  lg: 'w-[36rem]',
};

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  // Wires aria-labelledby to the caller's heading element id.
  titleId?: string;
  size?: DialogSize;
  // Off for dialogs that must not cancel mid-flight (e.g. a submit in
  // progress); defaults on.
  closeOnEscape?: boolean;
  // Extra classes appended to the panel (rarely needed).
  className?: string;
  children: ReactNode;
};

export function Dialog({
  open,
  onClose,
  titleId,
  size = 'sm',
  closeOnEscape = true,
  className,
  children,
}: DialogProps) {
  useEscape(onClose, { enabled: open && closeOnEscape, preventDefault: true });

  if (!open) return null;

  return (
    <Portal>
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`flex ${WIDTHS[size]} max-w-[92%] animate-fly-up-in flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40${
            className ? ` ${className}` : ''
          }`}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
