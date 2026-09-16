'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  EVENT_STORMING_NOTES,
  eventStormingNote,
  type EventStormingNoteKind,
} from '@livediagram/diagram';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogHeader } from '@/components/dialogs/DialogHeader';
import { ImageDropZone } from '@/components/canvas/ImageDropZone';
import { PHOTO_ACCEPT_ATTR } from '@/lib/photo-prepare';
import type { PhotoImportState, PhotoEdit } from '@/hooks/canvas/usePhotoImport';

// Importing a photograph of the wall (spec/139 Phase 8): pick → read → review
// → add.
//
// The review is the point of the whole dialog. A model reading somebody's
// handwriting will get some of it wrong, and an import that just happened
// would be an import nobody could trust — so every note found is shown, over
// the photo and in a list, with its words and its kind editable and a tick
// that decides whether it lands at all. Nothing is committed until "Add".

export type PhotoImportDialogProps = {
  open: boolean;
  state: PhotoImportState;
  onPickFile: (file: File) => void;
  onSetIncluded: (detectedId: number, on: boolean) => void;
  onEditNote: (detectedId: number, patch: PhotoEdit) => void;
  onCommit: () => void;
  onAgain: () => void;
  onClose: () => void;
  // Offered only when the dialog was opened by a pasted image: the author may
  // have meant to place a picture, not read a wall.
  onPlaceAsImage?: () => void;
};

const ERROR_COPY: Record<string, string> = {
  photo_unsupported_heic:
    'That looks like an iPhone HEIC photo. Save or export it as JPEG and try again.',
  photo_unsupported_type: 'That file is not a photo. Use a JPEG, PNG or WebP.',
  photo_unreadable: 'That photo could not be opened. Try another one.',
  photo_too_large: 'That photo is too large, even after resizing. Try a smaller one.',
  photo_invalid: 'That photo could not be read. Try another one.',
  ai_not_configured: 'Reading photos is not enabled on this deployment.',
  sign_in_required: 'Sign in to read a photo of your wall.',
  origin_not_allowed: 'Reading photos is not available from here.',
  rate_limited: 'Too many photos just now. Wait a moment and try again.',
  ai_error: 'The reader could not finish. Try again in a moment.',
};

export function PhotoImportDialog({
  open,
  state,
  onPickFile,
  onSetIncluded,
  onEditNote,
  onCommit,
  onAgain,
  onClose,
  onPlaceAsImage,
}: PhotoImportDialogProps) {
  const countRef = useRef<HTMLParagraphElement>(null);
  const busy = state.stage === 'preparing' || state.stage === 'reading';

  const rows = useMemo(() => {
    const r = state.reconciliation;
    if (!r || !state.response) return [];
    const additions = new Map(r.additions.map((a) => [a.detectedId, a]));
    const matched = new Map(r.matches.map((m) => [m.detectedId, m.boardId]));
    const differences = new Map(r.differences.map((d) => [d.detectedId, d.boardText]));
    return state.response.notes.map((note) => ({
      note,
      addition: additions.get(note.id) ?? null,
      onBoard: matched.has(note.id),
      boardText: differences.get(note.id) ?? null,
    }));
  }, [state.reconciliation, state.response]);

  const newCount = rows.filter((r) => r.addition !== null).length;
  const chosen = rows.filter((r) => r.addition && state.included.has(r.note.id)).length;
  const onBoardCount = rows.length - newCount;

  // Announce the count when it changes, not on every keystroke in the list.
  useEffect(() => {
    if (state.stage === 'review' && countRef.current) countRef.current.textContent = countLine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen, state.stage]);

  function countLine(): string {
    return `${rows.length} read · ${newCount} new · ${onBoardCount} already on the board`;
  }

  return (
    <Dialog open={open} onClose={onClose} size="2xl" closeOnEscape={!busy}>
      <DialogHeader
        title="Add notes from a photo"
        subtitle="Photograph a piece of the wall and the board reads the stickies out of it."
      />
      <div className="px-5 pb-5">
        {state.stage === 'done' ? (
          <div className="flex flex-col gap-3 py-6 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Added {state.addedCount} {state.addedCount === 1 ? 'note' : 'notes'}.
            </p>
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={onAgain}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Add another photo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Done
              </button>
            </div>
          </div>
        ) : null}

        {state.stage === 'idle' || state.stage === 'error' ? (
          <>
            <ImageDropZone
              onSelectFile={onPickFile}
              uploading={false}
              error={state.error ? (ERROR_COPY[state.error] ?? ERROR_COPY.ai_error!) : null}
              prompt="Drop a photo of the wall, or take one"
              heightClass="h-40"
              gapClass="gap-2"
              accept={PHOTO_ACCEPT_ATTR}
              hint="JPEG, PNG or WebP"
              capture
            />
            {/* The one line that has to be here rather than in a help page:
                somebody is about to hand us a picture of their unreleased
                strategy. */}
            <p className="mt-3 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              The photo is resized in your browser, read once, and never stored — not by this board,
              and not by us.
            </p>
            {onPlaceAsImage ? (
              <button
                type="button"
                onClick={onPlaceAsImage}
                className="mt-3 text-xs font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-300"
              >
                Place it as an image instead
              </button>
            ) : null}
          </>
        ) : null}

        {busy ? (
          <div className="flex flex-col items-center gap-3 py-8">
            {state.photo ? (
              <img
                src={state.photo.dataUrl}
                alt=""
                className="max-h-56 rounded-md opacity-60"
                width={state.photo.width}
                height={state.photo.height}
              />
            ) : null}
            <p className="text-sm text-slate-600 dark:text-slate-300" role="status">
              {state.stage === 'preparing' ? 'Getting the photo ready…' : 'Reading the notes…'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {state.stage === 'review' || state.stage === 'committing' ? (
          <>
            {state.response?.wall === false || rows.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  No stickies found in this photo
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                  {state.response?.hint ??
                    'Fill the frame with the wall, shoot straight on, and give it good light.'}
                </p>
                <button
                  type="button"
                  onClick={onAgain}
                  className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Try another photo
                </button>
              </div>
            ) : (
              <>
                <p
                  ref={countRef}
                  aria-live="polite"
                  className="mb-2 text-xs text-slate-600 dark:text-slate-300"
                >
                  {countLine()}
                </p>
                <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  {rows.map(({ note, addition, onBoard, boardText }) => (
                    <li
                      key={note.id}
                      className="flex items-start gap-2 rounded-md border border-slate-200 px-2 py-1.5 dark:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={addition !== null && state.included.has(note.id)}
                        disabled={addition === null}
                        aria-label={`Add “${note.text}”`}
                        onChange={(e) => onSetIncluded(note.id, e.target.checked)}
                      />
                      <div className="min-w-0 flex-1">
                        <input
                          type="text"
                          value={state.edits.get(note.id)?.text ?? note.text}
                          aria-label={`Text of “${note.text}”`}
                          disabled={addition === null}
                          onChange={(e) => onEditNote(note.id, { text: e.target.value })}
                          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-slate-800 focus:border-brand-300 focus:outline-none disabled:text-slate-400 dark:text-slate-100 dark:disabled:text-slate-500"
                        />
                        {onBoard ? (
                          <p className="px-1 text-[10px] text-slate-500 dark:text-slate-400">
                            {boardText ? `on the board as “${boardText}”` : 'already on the board'}
                          </p>
                        ) : null}
                        {addition?.dock ? (
                          <label className="flex items-center gap-1 px-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <input
                              type="checkbox"
                              checked={state.edits.get(note.id)?.dock !== false}
                              onChange={(e) => onEditNote(note.id, { dock: e.target.checked })}
                            />
                            dock it {addition.dock.side} its neighbour
                          </label>
                        ) : null}
                      </div>
                      <select
                        value={state.edits.get(note.id)?.kind ?? addition?.kind ?? 'domain-event'}
                        aria-label={`Kind of “${note.text}”`}
                        disabled={addition === null}
                        onChange={(e) =>
                          onEditNote(note.id, { kind: e.target.value as EventStormingNoteKind })
                        }
                        className="shrink-0 rounded border border-slate-300 bg-white px-1 py-0.5 text-[10px] text-slate-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {EVENT_STORMING_NOTES.map((n) => (
                          <option key={n.kind} value={n.kind}>
                            {n.label}
                          </option>
                        ))}
                      </select>
                      <span
                        aria-hidden
                        className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-black/10"
                        style={{
                          backgroundColor: eventStormingNote(
                            state.edits.get(note.id)?.kind ?? addition?.kind ?? 'domain-event',
                          ).fill,
                        }}
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onAgain}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Try another photo
                  </button>
                  <button
                    type="button"
                    onClick={onCommit}
                    disabled={chosen === 0 || state.stage === 'committing'}
                    className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    Add {chosen} {chosen === 1 ? 'note' : 'notes'}
                  </button>
                </div>
              </>
            )}
          </>
        ) : null}
      </div>
    </Dialog>
  );
}
