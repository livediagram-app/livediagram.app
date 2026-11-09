'use client';

import { useId, useMemo, useState } from 'react';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { lucideChevronLeft, lucideChevronRight } from '@liveworkspace/icons/lucide';
import {
  DEFAULT_NOTE_COLOR,
  localDay,
  NOTE_PAPER,
  NOTES_MAX,
  type ShapeElement,
} from '@livehuddle/document';
import { lucideGlyph, Tooltip } from '@livehuddle/ui';
import {
  calendarMonth,
  cursorOf,
  longDay,
  monthTitle,
  shortDay,
  stepMonth,
  WEEKDAY_INITIALS,
  WEEKDAY_NAMES,
  type MonthCursor,
} from '@/lib/calendar-month';
import { notesByDay } from './calendar-notes';
import { ReaderShell } from './ReaderShell';
import { NOTE_SIZES, NoteAddForm, NoteCard } from './NoteParts';
import { useNoteSigner } from './useNoteSigner';

// A Calendar Wall's month (docs/specs/009-elements/team-pieces.md "Calendar Wall"): a month to step through, each day
// a button with its notes' tabs, the selected day's notes below, and the add box that pins to that day. Its notes are
// a Notice Board's with a day, sent as the same deltas and signed the same way (useNoteSigner). Opened by the face's
// Calendar button as a popover, or large in the reader while walking.

const PrevIcon = lucideGlyph(lucideChevronLeft, 14);
const NextIcon = lucideGlyph(lucideChevronRight, 14);

export function CalendarWallPopover({
  element,
  anchor,
  onClose,
}: {
  element: ShapeElement;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  return (
    <AnchoredPopover anchor={anchor} name="Calendar Wall" width={320} onClose={onClose} pointer>
      <CalendarNotes element={element} size="popover" />
    </AnchoredPopover>
  );
}

/** The month opened large while walking (docs/specs/008-canvas/avatar-mode.md "The reader"). */
export function CalendarWallReader({
  element,
  onClose,
}: {
  element: ShapeElement;
  onClose: () => void;
}) {
  return (
    <ReaderShell
      title={element.label?.trim() || 'Calendar Wall'}
      onClose={onClose}
      data-calendar-reader
    >
      <CalendarNotes element={element} size="reader" />
    </ReaderShell>
  );
}

const GRID = {
  popover: { cell: 'h-8 text-[11.5px]', head: 'text-[10px]', month: 'text-[13px]' },
  reader: { cell: 'h-12 text-[15px]', head: 'text-[12px]', month: 'text-[17px]' },
} as const;

function CalendarNotes({
  element,
  size,
}: {
  element: ShapeElement;
  size: keyof typeof NOTE_SIZES;
}) {
  const z = NOTE_SIZES[size];
  const g = GRID[size];
  const { myKey, mayPin, mayUnpin, authorName, send } = useNoteSigner(element, 'Calendar-wall');
  const titleId = useId();
  const listId = useId();
  // Read once on opening: a calendar left open over midnight keeps the day it opened on selected.
  const [today] = useState(() => localDay(Date.now()));
  const [selected, setSelected] = useState(today);
  const [cursor, setCursor] = useState<MonthCursor>(() => cursorOf(today));
  const byDay = useMemo(() => notesByDay(element.noticeNotes), [element.noticeNotes]);
  const cells = useMemo(() => calendarMonth(cursor, today), [cursor, today]);
  const dayNotes = byDay.get(selected) ?? [];
  const full = (element.noticeNotes?.length ?? 0) >= NOTES_MAX;
  const nav =
    'flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

  const pick = (day: string) => {
    setSelected(day);
    const at = cursorOf(day);
    if (at.year !== cursor.year || at.month !== cursor.month) setCursor(at);
  };

  return (
    <div className={`${z.wrap} text-slate-800 dark:text-slate-100`}>
      <div className="flex items-center gap-1">
        <h2 id={titleId} className={`${g.month} mr-auto font-semibold`} aria-live="polite">
          {monthTitle(cursor)}
        </h2>
        <Tooltip label="Previous Month">
          <button
            type="button"
            aria-label="Previous month"
            className={nav}
            onClick={() => setCursor((c) => stepMonth(c, -1))}
          >
            <PrevIcon />
          </button>
        </Tooltip>
        <button
          type="button"
          onClick={() => {
            setCursor(cursorOf(today));
            setSelected(today);
          }}
          className="cursor-pointer rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-500 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800"
        >
          Today
        </button>
        <Tooltip label="Next Month">
          <button
            type="button"
            aria-label="Next month"
            className={nav}
            onClick={() => setCursor((c) => stepMonth(c, 1))}
          >
            <NextIcon />
          </button>
        </Tooltip>
      </div>
      <div role="grid" aria-labelledby={titleId} className="grid grid-cols-7 gap-0.5">
        <div role="row" className="contents">
          {WEEKDAY_INITIALS.map((d, i) => (
            <span
              key={WEEKDAY_NAMES[i]}
              role="columnheader"
              aria-label={WEEKDAY_NAMES[i]}
              className={`${g.head} pb-0.5 text-center font-semibold text-slate-500 dark:text-slate-400`}
            >
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: cells.length / 7 }, (_, week) => (
          <div role="row" className="contents" key={week}>
            {cells.slice(week * 7, week * 7 + 7).map((cell) => {
              const notes = byDay.get(cell.day) ?? [];
              const isSelected = cell.day === selected;
              return (
                <span role="gridcell" key={cell.day} className="contents">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${longDay(cell.day)}${cell.isToday ? ', today' : ''}${
                      notes.length
                        ? `, ${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`
                        : ''
                    }`}
                    onClick={() => pick(cell.day)}
                    className={`relative flex ${g.cell} cursor-pointer flex-col items-center justify-start rounded-md pt-1 tabular-nums transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sky-500 ${
                      isSelected
                        ? 'bg-sky-600 font-semibold text-white dark:bg-sky-500 dark:text-slate-950'
                        : cell.inMonth
                          ? 'text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-400 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60'
                    } ${cell.isToday && !isSelected ? 'ring-2 ring-inset ring-red-500' : ''}`}
                  >
                    <span className="leading-none">{cell.date}</span>
                    {notes.length > 0 ? (
                      <span aria-hidden className="mt-1 flex gap-0.5">
                        {notes.slice(0, 3).map((n) => (
                          <span
                            key={n.id}
                            className="h-1.5 w-1.5 rounded-full ring-1 ring-black/25"
                            style={{ background: NOTE_PAPER[n.color ?? DEFAULT_NOTE_COLOR] }}
                          />
                        ))}
                      </span>
                    ) : null}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      <h3 id={listId} className={`${z.title} mt-1 font-semibold`}>
        {longDay(selected)}
        {selected === today ? (
          <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">Today</span>
        ) : null}
      </h3>
      <ul className={z.list} aria-labelledby={listId}>
        {dayNotes.length === 0 ? (
          <li className={`col-span-full py-2 ${z.body} text-slate-500 dark:text-slate-400`}>
            No Notes Yet
            {mayPin ? <span className="block text-[11px]">Pin one to this day below.</span> : null}
          </li>
        ) : (
          dayNotes.map((note) => (
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
      {mayPin ? (
        <NoteAddForm
          z={z}
          full={full}
          fullMessage="This calendar is full. Unpin a note to pin another."
          submitLabel={`Pin to ${shortDay(selected)}`}
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
                day: selected,
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
