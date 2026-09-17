'use client';

// The draft bar (spec/139 Phase 8): what the photo read, and the two ways out.
//
// Shown whenever the active tab HAS draft notes, which is derived from the
// elements rather than from a session flag — so a reload mid-import comes back
// to a board that still knows what those notes are and still offers Add and
// Discard. The fade and the badges are session-local and do not come back; the
// decision does, because the notes are real.
//
// Bottom-centre, in the modifier-hint banner's visual language: it is the same
// kind of thing, a transient strip that says what is going on right now.

export function PhotoDraftBar({
  draftCount,
  read,
  readFailed = false,
  matchedCount,
  busy,
  onAccept,
  onDiscard,
}: {
  draftCount: number;
  // What the photo read in total, when this session is the one that read it.
  // Null after a reload: the notes survived, the tally did not.
  read: number | null;
  // The reader failed but the detector landed the notes blank: say so and tell
  // the author what to do with them, rather than pretending the photo was read.
  readFailed?: boolean;
  matchedCount: number | null;
  busy: boolean;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  if (draftCount === 0) return null;
  const line = readFailed
    ? `${read} found · the reader could not finish · type the words in yourself`
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
