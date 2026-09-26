'use client';

// The draft bar (docs/specs/021-event-storming/event-storming.md Phase 8): what the photo read, and the two ways out.
//
// Shown whenever the active tab HAS draft notes, which is derived from the
// elements rather than from a session flag — so a reload mid-import comes back
// to a board that still knows what those notes are and still offers Add and
// Discard. The fade and the badges are session-local and do not come back; the
// decision does, because the notes are real.
//
// Bottom-centre, in the modifier-hint banner's visual language: it is the same
// kind of thing, a transient strip that says what is going on right now.

// What each reader failure MEANS, in the bar's own voice: short enough for the
// line, specific enough that the author knows whether retrying will help.
const READ_ERROR_LINES: Record<string, string> = {
  ai_quota: 'the model key has used up its quota',
  rate_limited: 'the model is busy right now',
  ai_error: 'the reader could not finish',
  sign_in_required: 'sign in to read the photo',
  origin_not_allowed: 'reading is not available from here',
  ai_not_configured: 'reading is not enabled on this deployment',
};

export function PhotoDraftBar({
  draftCount,
  read,
  readError,
  matchedCount,
  busy,
  onAccept,
  onDiscard,
}: {
  draftCount: number;
  // What the photo read in total, when this session is the one that read it.
  // Null after a reload: the notes survived, the tally did not.
  read: number | null;
  // The failure token when the reader could not finish but the notes landed
  // blank. The bar names the CAUSE, not just the fact: the author deserves to
  // know whether retrying will help, and the toast is gone in a blink.
  readError?: string;
  matchedCount: number | null;
  busy: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  if (draftCount === 0) return null;
  const line = readError
    ? `${read} found · ${READ_ERROR_LINES[readError] ?? READ_ERROR_LINES.ai_error} · type the words in yourself`
    : read !== null && matchedCount !== null
      ? `${read} read · ${draftCount} new · ${matchedCount} already on the board`
      : `${draftCount} ${draftCount === 1 ? 'note' : 'notes'} from a photo, not added yet`;

  return (
    <div
      data-testid="photo-draft-bar"
      // Fixed and out of flow, so nothing on the canvas shifts when it appears
      // or goes (zero CLS).
      className="pointer-events-none fixed bottom-20 left-1/2 z-[var(--z-chrome)] -translate-x-1/2"
    >
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <p aria-live="polite" className="text-[11px] text-slate-600 dark:text-slate-300">
          {line}
        </p>
        <button
          type="button"
          onClick={onDiscard}
          disabled={busy}
          className="rounded-full border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onAccept}
          disabled={busy || draftCount === 0}
          className="rounded-full bg-brand-500 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          Add {draftCount} {draftCount === 1 ? 'note' : 'notes'}
        </button>
      </div>
    </div>
  );
}
