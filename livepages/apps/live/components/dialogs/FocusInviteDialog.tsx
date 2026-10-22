'use client';

// The invitation somebody's Bring Focus press puts on your screen (docs/specs/012-collaboration/bring-focus.md).
//
// A dialog rather than a pill in the chrome: it is a question addressed to YOU, and the answer decides
// where you are looking next. A banner at the top of the canvas is the shape
// of a status line, and it was read as one: missed entirely on a busy canvas,
// which for an element whose whole job is "everybody look here" is the element
// not working.
//
// Escape and the backdrop both decline: dismissing is a
// real answer, not a silent drop.

import { Dialog } from '@/components/dialogs/Dialog';
import { SOLID_BRAND_DARK_CONTROL } from '@livepages/ui';

export function FocusInviteDialog({
  from,
  toPage = false,
  onAccept,
  onDismiss,
}: {
  // The name of whoever pressed, resolved from presence by the caller. Null
  // when there is no invitation, which renders nothing.
  from: string | null;
  // It points at a page of a Pages tab, which taking it frames whole (bring-focus.md "On a page"),
  // so the zoom is not kept and the copy must not promise it.
  toPage?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  if (!from) return null;
  return (
    <Dialog open onClose={onDismiss} ariaLabel="Someone wants you to look at something" size="sm">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            Bring Focus
          </span>
          <h2 className="text-base font-semibold leading-snug text-slate-800 dark:text-slate-100">
            {from} wants you to look at something
          </h2>
          <p className="text-[13px] leading-snug text-slate-500 dark:text-slate-400">
            {toPage
              ? 'This will take you to the page they are pointing at, fitted to your screen.'
              : 'This will move your view to where they are pointing, keeping your zoom.'}{' '}
            Your view is your own again straight afterwards.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="cursor-pointer rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Not now
          </button>
          <button
            type="button"
            autoFocus
            onClick={onAccept}
            className={`cursor-pointer rounded-lg bg-brand-700 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-brand-800 ${SOLID_BRAND_DARK_CONTROL}`}
          >
            Take me there
          </button>
        </div>
      </div>
    </Dialog>
  );
}
