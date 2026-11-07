'use client';

import { useId } from 'react';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { NOTES_MAX, notesNewestFirst, type ShapeElement } from '@livehuddle/document';
import { ReaderShell } from './ReaderShell';
import { NOTE_SIZES, NoteAddForm, NoteCard } from './NoteParts';
import { useNoteSigner } from './useNoteSigner';

// A Notice Board's notes (docs/specs/009-elements/social-pieces.md "Notice Board"): every note newest first, and an
// add box for those who may pin. An Editor or a Participant pins and unpins its own; an Editor unpins any; a Viewer
// reads. A pin and an unpin are each one delta (docs/specs/012-collaboration/collab-race-hardening.md), never a
// whole-element update, so an Editor moving the board in the same moment cannot carry the old notes over a new one;
// the room relays a Participant's only when signed with its own adder key. Not undoable, like a comment. Only this
// open popover reads the editor's context, so the boards on the canvas never re-render with it.

export function NoticeBoardPopover({
  element,
  anchor,
  onClose,
}: {
  element: ShapeElement;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  return (
    <AnchoredPopover anchor={anchor} name="Notice Board" width={300} onClose={onClose} pointer>
      <NoticeBoardNotes element={element} size="popover" />
    </AnchoredPopover>
  );
}

/** The notes opened large while walking (docs/specs/008-canvas/avatar-mode.md "The reader"). */
export function NoticeBoardReader({
  element,
  onClose,
}: {
  element: ShapeElement;
  onClose: () => void;
}) {
  return (
    <ReaderShell
      title={element.label?.trim() || 'Notice Board'}
      onClose={onClose}
      data-notice-reader
    >
      <NoticeBoardNotes element={element} size="reader" />
    </ReaderShell>
  );
}

function NoticeBoardNotes({
  element,
  size,
}: {
  element: ShapeElement;
  size: keyof typeof NOTE_SIZES;
}) {
  const z = NOTE_SIZES[size];
  const { myKey, mayPin, mayUnpin, authorName, send } = useNoteSigner(element, 'Notice-board');
  const titleId = useId();
  const notes = notesNewestFirst(element.noticeNotes);
  const full = notes.length >= NOTES_MAX;

  return (
    <div className={`${z.wrap} text-slate-800 dark:text-slate-100`}>
      {size === 'popover' ? (
        <h2 id={titleId} className="text-[13px] font-semibold">
          Notice Board
        </h2>
      ) : (
        <h2 id={titleId} className="sr-only">
          Notes
        </h2>
      )}
      {mayPin ? (
        <NoteAddForm
          z={z}
          full={full}
          fullMessage="This board is full. Unpin a note to pin another."
          submitLabel="Pin Note"
          onPin={(draft) => {
            if (!myKey) return;
            send({
              kind: 'notice-pin',
              note: {
                id: crypto.randomUUID(),
                ...draft,
                author: authorName,
                by: myKey,
                at: Date.now(),
              },
            });
          }}
        />
      ) : null}
      <ul className={z.list} aria-labelledby={titleId}>
        {notes.length === 0 ? (
          <li
            className={`col-span-full py-4 text-center ${z.body} text-slate-500 dark:text-slate-400`}
          >
            No Notes Yet
            {mayPin ? <span className="block text-[11px]">Pin the first one above.</span> : null}
          </li>
        ) : (
          notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              z={z}
              onUnpin={
                mayUnpin(note)
                  ? () => send({ kind: 'notice-unpin', noteId: note.id, by: note.by })
                  : undefined
              }
            />
          ))
        )}
      </ul>
    </div>
  );
}
