'use client';

// A notice in the toast stack (liveworkspace/docs/specs/016-notifications/toasts.md "One place for everything that
// pops up"): an Inbox notice, a suggestion or the paste notice draws its card here, and it lands in the page's one
// stack, above the toasts, standing on the same bottom chrome. It keeps its own rules (when it shows, how long, what
// closing means). While mounted it is counted, so the stack measures its floor with only a notice up, and it holds the
// notice slot unless it yields (`hold` false, a suggestion). With no stack on the page it stands at the bottom
// centre on its own, where the stack would be.
import { useLayoutEffect, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { countNotice, holdNoticeSlot, noticeRow, onNoticeRow } from './notice-slot';

const none = () => null;

export function ToastNotice({ hold = true, children }: { hold?: boolean; children: ReactNode }) {
  const row = useSyncExternalStore(onNoticeRow, noticeRow, none);
  useLayoutEffect(() => countNotice(), []);
  useLayoutEffect(() => (hold ? holdNoticeSlot() : undefined), [hold]);
  if (row) return createPortal(children, row);
  return (
    <div
      data-toast-notice-alone=""
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[var(--z-toast)] flex flex-col items-center gap-2 px-4"
    >
      {children}
    </div>
  );
}
