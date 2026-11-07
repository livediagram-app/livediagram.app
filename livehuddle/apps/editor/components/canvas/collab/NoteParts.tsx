'use client';

import { useState } from 'react';
import {
  DEFAULT_NOTE_COLOR,
  NOTE_COLOR_LABELS,
  NOTE_COLORS,
  NOTE_PAPER,
  NOTE_TEXT_MAX,
  NOTE_TITLE_MAX,
  type NoteColor,
  type NoticeNote,
} from '@livehuddle/document';
import { Tooltip } from '@livehuddle/ui';
import { shortDayAt } from '@/lib/calendar-month';

// The parts every piece that holds notes shares (the Notice Board, docs/specs/009-elements/social-pieces.md; the
// Calendar Wall, team-pieces.md): the type for the two ways they open, the add box and a note's card, so both read the
// same and a change to one is a change to both.

// The small popover by a piece's button, and the reader while walking (docs/specs/008-canvas/avatar-mode.md
// "The reader"), at a size that reads on any screen.
export const NOTE_SIZES = {
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

export type NoteSize = (typeof NOTE_SIZES)[keyof typeof NOTE_SIZES];

/** What the add box hands its piece: the note's words and colour, trimmed and cut to their limits. */
export type NoteDraft = Pick<NoticeNote, 'title' | 'text' | 'color'>;

/** The add box: a title (optional), the body with a live counter, the five colours and the piece's pin button. */
export function NoteAddForm({
  z,
  full,
  fullMessage,
  submitLabel,
  onPin,
}: {
  z: NoteSize;
  full: boolean;
  fullMessage: string;
  submitLabel: string;
  onPin: (draft: NoteDraft) => void;
}) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [color, setColor] = useState<NoteColor>(DEFAULT_NOTE_COLOR);
  const pin = () => {
    const body = text.trim();
    if (!body || full) return;
    onPin({
      ...(title.trim() ? { title: title.trim().slice(0, NOTE_TITLE_MAX) } : {}),
      text: body.slice(0, NOTE_TEXT_MAX),
      ...(color !== DEFAULT_NOTE_COLOR ? { color } : {}),
    });
    setTitle('');
    setText('');
  };
  return (
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
          {submitLabel}
        </button>
      </div>
      {full ? (
        <p className="text-[10px] text-amber-700 dark:text-amber-400">{fullMessage}</p>
      ) : null}
    </form>
  );
}

/** One note's card: its paper, title, body, author and pin date, and an Unpin for those who may. */
export function NoteCard({
  note,
  z,
  onUnpin,
}: {
  note: NoticeNote;
  z: NoteSize;
  onUnpin?: () => void;
}) {
  return (
    <li
      className={`${z.note} text-slate-800 shadow-sm`}
      style={{ background: NOTE_PAPER[note.color ?? DEFAULT_NOTE_COLOR] }}
    >
      {note.title ? <p className={`${z.title} font-semibold`}>{note.title}</p> : null}
      <p className={`whitespace-pre-wrap break-words ${z.body}`}>{note.text}</p>
      <div className={`mt-1 flex items-center gap-2 ${z.meta} text-slate-600`}>
        <span className="truncate">
          {note.author} · {shortDayAt(note.at)}
        </span>
        {onUnpin ? (
          <button
            type="button"
            onClick={onUnpin}
            className="ml-auto cursor-pointer rounded px-1 font-semibold text-slate-700 hover:bg-black/10"
          >
            Unpin
          </button>
        ) : null}
      </div>
    </li>
  );
}
