'use client';

import { useId, useState } from 'react';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import {
  DEFAULT_NOTE_COLOR,
  NOTE_COLOR_LABELS,
  NOTE_COLORS,
  NOTE_PAPER,
  NOTE_TEXT_MAX,
  NOTE_TITLE_MAX,
  NOTES_MAX,
  notesNewestFirst,
  type NoteColor,
  type ElementDelta,
  type NoticeNote,
  type ShapeElement,
} from '@livehuddle/document';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { Tooltip } from '@livehuddle/ui';
import { participantKey } from '@/lib/identity';
import { track } from '@/lib/telemetry';
import { ReaderShell } from './ReaderShell';

// A Notice Board's notes (docs/specs/009-elements/social-pieces.md "Notice Board"): every note newest first, and an
// add box for those who may pin. An Editor or a Participant pins and unpins its own; an Editor unpins any; a Viewer
// reads. A pin and an unpin are each one delta (docs/specs/012-collaboration/collab-race-hardening.md), never a
// whole-element update, so an Editor moving the board in the same moment cannot carry the old notes over a new one;
// the room relays a Participant's only when signed with its own adder key. Not undoable, like a comment. Only this
// open popover reads the editor's context, so the boards on the canvas never re-render with it.

const DATE = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

// The type for the two ways the notes open: the small popover by the Notes button, and the reader while walking
// (docs/specs/008-canvas/avatar-mode.md "The reader"), at a size that reads on any screen.
const SIZES = {
  popover: {
    wrap: 'flex max-h-[min(70vh,520px)] flex-col gap-2 p-3',
    field: 'text-[12px]',
    title: 'text-[12px]',
    body: 'text-[12px]',
    meta: 'text-[10px]',
    action: 'px-2 py-1 text-[11px]',
    list: 'flex min-h-0 flex-col gap-1.5 overflow-y-auto',
    note: 'rounded-md px-2 py-1.5',
  },
  reader: {
    wrap: 'flex flex-col gap-3 p-4 sm:p-5',
    field: 'text-[15px]',
    title: 'text-[16px]',
    body: 'text-[15px] leading-relaxed',
    meta: 'text-[12px]',
    action: 'px-3 py-1.5 text-[13px]',
    list: 'grid gap-3 sm:grid-cols-2',
    note: 'rounded-lg px-3.5 py-3',
  },
} as const;

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

function NoticeBoardNotes({ element, size }: { element: ShapeElement; size: keyof typeof SIZES }) {
  const z = SIZES[size];
  const editor = useOptionalEditorContext();
  const titleId = useId();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [color, setColor] = useState<NoteColor>(DEFAULT_NOTE_COLOR);
  const notes = notesNewestFirst(element.noticeNotes);
  const level = editor?.can.level ?? 'view';
  const isEditor = level === 'edit';
  // Who signs a note: a Participant's adder key, which the room checks; an Editor's, or its participant key.
  const myKey = editor
    ? editor.participating
      ? editor.adderKey
      : (editor.adderKey ?? participantKey(editor.selfParticipant))
    : null;
  const mayPin =
    !!editor && (isEditor || (level === 'participate' && !!myKey)) && element.locked !== true;
  const full = notes.length >= NOTES_MAX;

  const send = (delta: ElementDelta) => {
    editor?.applyElementDelta(element.id, delta);
    track('Element', 'Changed', 'Notice-board');
  };

  const pin = () => {
    const body = text.trim();
    if (!body || !myKey || full) return;
    const note: NoticeNote = {
      id: crypto.randomUUID(),
      ...(title.trim() ? { title: title.trim().slice(0, NOTE_TITLE_MAX) } : {}),
      text: body.slice(0, NOTE_TEXT_MAX),
      author: (editor?.selfParticipant.name || 'Someone').slice(0, 60),
      by: myKey,
      at: Date.now(),
      ...(color !== DEFAULT_NOTE_COLOR ? { color } : {}),
    };
    send({ kind: 'notice-pin', note });
    setTitle('');
    setText('');
  };

  const unpin = (note: NoticeNote) => send({ kind: 'notice-unpin', noteId: note.id, by: note.by });

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
        <form
          className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
          onSubmit={(e) => {
            e.preventDefault();
            pin();
          }}
        >
          <input
            value={title}
            maxLength={NOTE_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            aria-label="Note title"
            className={`rounded-md border border-slate-200 bg-white px-2 py-1 ${z.field} outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900`}
          />
          <textarea
            value={text}
            maxLength={NOTE_TEXT_MAX}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a note"
            aria-label="Note"
            rows={3}
            className={`resize-none rounded-md border border-slate-200 bg-white px-2 py-1 ${z.field} outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900`}
          />
          <div className="flex items-center gap-1.5">
            <div role="radiogroup" aria-label="Note colour" className="flex gap-1">
              {NOTE_COLORS.map((c) => (
                <Tooltip key={c} label={NOTE_COLOR_LABELS[c]}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={NOTE_COLOR_LABELS[c]}
                    onClick={() => setColor(c)}
                    className={`h-4 w-4 cursor-pointer rounded-full border ${
                      color === c
                        ? 'border-slate-700 ring-2 ring-sky-500 dark:border-slate-200'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                    style={{ background: NOTE_PAPER[c] }}
                  />
                </Tooltip>
              ))}
            </div>
            <span className="ml-auto text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
              {text.length}/{NOTE_TEXT_MAX}
            </span>
            <button
              type="submit"
              disabled={!text.trim() || full}
              className={`cursor-pointer rounded-md bg-sky-600 ${z.action} font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Pin Note
            </button>
          </div>
          {full ? (
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              This board is full. Unpin a note to pin another.
            </p>
          ) : null}
        </form>
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
          notes.map((note) => {
            const mayUnpin = !!editor && (isEditor || (mayPin && note.by === myKey));
            return (
              <li
                key={note.id}
                className={`${z.note} text-slate-800 shadow-sm`}
                style={{ background: NOTE_PAPER[note.color ?? DEFAULT_NOTE_COLOR] }}
              >
                {note.title ? <p className={`${z.title} font-semibold`}>{note.title}</p> : null}
                <p className={`whitespace-pre-wrap break-words ${z.body}`}>{note.text}</p>
                <div className={`mt-1 flex items-center gap-2 ${z.meta} text-slate-600`}>
                  <span className="truncate">
                    {note.author} · {DATE.format(note.at)}
                  </span>
                  {mayUnpin ? (
                    <button
                      type="button"
                      onClick={() => unpin(note)}
                      className="ml-auto cursor-pointer rounded px-1 font-semibold text-slate-700 hover:bg-black/10"
                    >
                      Unpin
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
