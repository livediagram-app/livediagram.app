'use client';

// Request Access on a live embed's no-access card (liveworkspace/docs/specs/004-index/live-embeds.md "What a reader
// sees"; request-access.md "On screen"): one small button beside Open, no note (the card is a few lines on a canvas),
// then Requested. Its presses stay off the canvas, as the card's other controls do. Requested is shared with every
// other embed and the Not Found card of the same item in this tab (./requested).
import { Tooltip, lucideGlyph } from '@liveworkspace/ui';
import { lucideCheck, lucideKey } from '@liveworkspace/icons/lucide';
import { REQUEST_FAILURE_TEXT, useAskForAccess, type AskForAccess } from './requested';

const KeyGlyph = lucideGlyph(lucideKey, 12);
const CheckGlyph = lucideGlyph(lucideCheck, 12);

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function RequestAccessButton({ itemId, ask }: { itemId: string; ask?: AskForAccess }) {
  const { requested, sending, failed, send } = useAskForAccess(itemId, ask);
  if (requested) {
    return (
      <span
        role="status"
        data-request-access-state="requested"
        className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
      >
        <CheckGlyph />
        Requested
      </span>
    );
  }
  return (
    <>
      <Tooltip label="Ask its owner to share it with you">
        <button
          type="button"
          data-request-access-state={sending ? 'sending' : 'ready'}
          aria-disabled={sending || undefined}
          onPointerDown={stop}
          onDoubleClick={stop}
          onClick={(e) => {
            e.stopPropagation();
            void send(null);
          }}
          className="pointer-events-auto mt-1 inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 aria-disabled:cursor-wait aria-disabled:opacity-70 motion-reduce:transition-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:active:bg-slate-600"
        >
          <KeyGlyph />
          {sending ? 'Sending…' : 'Request Access'}
        </button>
      </Tooltip>
      {failed ? (
        <span role="alert" className="text-[10px] leading-snug text-rose-700 dark:text-rose-300">
          {REQUEST_FAILURE_TEXT[failed]}
        </span>
      ) : null}
    </>
  );
}
