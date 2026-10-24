'use client';

import type { ReactNode } from 'react';
import { Dialog as Shell, type DialogProps } from '@liveworkspace/ui';
import { CloseIcon } from './icons';

// @liveworkspace/ui's Dialog shell (packages/ui/src/dialog/Dialog.tsx), drawn while mounted: the Explorer's dialogs
// mount only while open, so it is always open. The dim backdrop and centred panel, Escape and a press on the
// backdrop to close, focus kept inside while open and handed back after; the larger sizes fill a phone's screen.
// Callers compose their own header, body and footer from the compact parts below.

export type DialogSize = NonNullable<DialogProps['size']>;

export function Dialog(props: Omit<DialogProps, 'open'> & { ariaLabel: string }) {
  return <Shell open {...props} />;
}

export function DialogCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      className="relative -mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      <CloseIcon />
    </button>
  );
}

export function DialogHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-3 pt-5 dark:border-slate-800">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
        ) : null}
      </div>
      <div className="-mt-1 flex shrink-0 items-center gap-1">{children}</div>
    </div>
  );
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
      {children}
    </div>
  );
}
