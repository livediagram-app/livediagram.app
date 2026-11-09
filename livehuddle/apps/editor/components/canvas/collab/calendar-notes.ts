// The Calendar Wall's notes by day (docs/specs/009-elements/team-pieces.md "Calendar Wall"), apart from its popover:
// the face draws each day's tabs from them on every board that has one, while the popover and the reader load only
// when opened (docs/specs/016-platform/web-performance.md "A piece's panel").
import { noteDay, notesNewestFirst, type NoticeNote } from '@livehuddle/document';

/** A day's notes, by day, newest first within each: built once per change of the notes. */
export function notesByDay(notes: readonly NoticeNote[] | undefined): Map<string, NoticeNote[]> {
  const byDay = new Map<string, NoticeNote[]>();
  for (const note of notesNewestFirst(notes)) {
    const day = noteDay(note);
    const list = byDay.get(day);
    if (list) list.push(note);
    else byDay.set(day, [note]);
  }
  return byDay;
}
