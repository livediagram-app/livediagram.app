'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Portal } from './Portal';
import { CloseIcon } from './icons';
import { useLatest } from './useLatest';

// liveplanner's Dialog shell (packages/ui/src/dialog/Dialog.tsx): the dim backdrop and centred panel, Escape
// and a press on the backdrop to close, focus kept inside while open and handed back after. The larger sizes
// fill a phone's screen. Callers compose their own header, body and footer.

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl';

const WIDTHS: Record<DialogSize, string> = {
  sm: 'w-[26rem]',
  md: 'w-[30rem]',
  lg: 'w-[34rem]',
  xl: 'w-[36rem]',
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  onClose,
  ariaLabel,
  size = 'sm',
  closeOnEscape = true,
  className,
  children,
}: {
  onClose: () => void;
  ariaLabel: string;
  size?: DialogSize;
  closeOnEscape?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const pressedBackdrop = useRef(false);
  const close = useLatest(onClose);
  const escape = useLatest(closeOnEscape);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && escape.current) {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      } else if (e.key === 'Tab' && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const at = items.indexOf(document.activeElement as HTMLElement);
        const last = items.length - 1;
        if (e.shiftKey && at <= 0) {
          e.preventDefault();
          items[last]?.focus();
        } else if (!e.shiftKey && at === last) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [close, escape]);

  return (
    <Portal>
      <div
        onPointerDown={(e) => {
          pressedBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && pressedBackdrop.current) close.current();
          pressedBackdrop.current = false;
        }}
        className="fixed inset-0 z-50 flex animate-fade-in items-center justify-center bg-slate-900/40 backdrop-blur-sm dark:bg-slate-950/60"
      >
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={`flex ${WIDTHS[size]} max-w-[92%] flex-col rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10 outline-none dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-950/40${
            size === 'sm'
              ? ''
              : ' max-sm:h-full max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0'
          }${className?.includes('max-h') ? '' : ' max-h-[calc(100dvh-2rem)] overflow-y-auto'}${
            className ? ` ${className}` : ''
          }`}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
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
