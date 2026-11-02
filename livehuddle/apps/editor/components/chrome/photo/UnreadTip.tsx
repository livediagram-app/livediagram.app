'use client';

// "Some notes couldn't be read" (docs/specs/021-event-storming/event-storming.md Phase 9). Said once the reader has
// finished and a tenth or more of the notes it was given still have no words:
// politely, as a suggestion, with the choice left to the author — a better
// photo, or typing the words in. Never blocking, never decided for them —
// so the two choices carry EQUAL weight; neither is dressed as the default.

// The share of unread notes at which the tip appears.
export const UNREAD_TIP_SHARE = 0.1;

export function UnreadTip({
  unread,
  total,
  onRetake,
  onDismiss,
}: {
  unread: number;
  total: number;
  onRetake: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      data-testid="photo-unread-tip"
      role="status"
      className="pointer-events-auto flex max-w-[min(34rem,90vw)] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-slate-900/90 px-4 py-2.5 text-center text-xs text-white shadow-lg backdrop-blur"
    >
      <p>
        {unread} of {total} notes couldn&rsquo;t be read automatically. A closer, sharper photo
        usually helps &mdash; or you can type the words in yourself.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetake}
          className="rounded-full border border-white/40 px-3 py-1 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Try another photo
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-full border border-white/40 px-3 py-1 text-white hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          I&rsquo;ll type them
        </button>
      </div>
    </div>
  );
}
