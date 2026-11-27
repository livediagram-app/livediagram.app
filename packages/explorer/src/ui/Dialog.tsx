'use client';

import type { ReactNode } from 'react';
import { Dialog as Shell, type DialogProps } from '@liveworkspace/ui';

// @liveworkspace/ui's Dialog shell (packages/ui/src/dialog/Dialog.tsx), drawn while mounted: the Explorer's dialogs
// mount only while open, so it is always open. The dim backdrop and centred panel, Escape and a press on the
// backdrop to close, focus kept inside while open and handed back after; the larger sizes fill a phone's screen.
// Callers compose their own header, body and footer from the compact parts below.

export type DialogSize = NonNullable<DialogProps['size']>;

export function Dialog(props: Omit<DialogProps, 'open'> & { ariaLabel: string }) {
  return <Shell open {...props} />;
}

// The one close every modal header wears (liveworkspace/docs/specs/022-interface-design/close-button.md).
export { DialogCloseButton } from '@liveworkspace/ui';

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
      {/* Pulled 10px up and down: the 44px close centres on the 24px title line without making the row taller. */}
      <div className="-my-2.5 flex shrink-0 items-center gap-1">{children}</div>
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
