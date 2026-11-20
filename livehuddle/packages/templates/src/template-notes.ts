// The notes a template pins to a Notice Board (docs/specs/012-collaboration/virtual-office-template.md "Notes the
// template pins"): a walk-up board that already answers, so the first press on it reads how the Space works rather
// than No notes yet. Each is a real Notice Board note (docs/specs/009-elements/social-pieces.md "Notice Board"), pinned
// by livehuddle when the Space is made, signed by no person, so only an Editor unpins it.
//
// Pure apart from the clock: pinnedNotes stamps the notes with the moment the Space is made.

import type { NoteColor, NoticeNote } from '@livehuddle/document';

/** A note as a template writes it: a title, a body (at most 280 characters) and a colour. */
export type TemplateNote = { title: string; text: string; color: NoteColor };

// Who pinned it, on the note and in the popover: the product, never a person.
export const TEMPLATE_NOTE_AUTHOR = 'livehuddle';
// The signer: no person's adder key, so no Participant can unpin it (an Editor may unpin any note).
export const TEMPLATE_NOTE_SIGNER = 'template';

/**
 * The template's notes as stored notes, oldest first as a board stores them, one second apart and pinned by `now`: the
 * template's first note is the newest, so the face (newest first, `notesNewestFirst`) reads them in the order written.
 */
export function pinnedNotes(notes: readonly TemplateNote[], now = Date.now()): NoticeNote[] {
  const pinned = notes.map((n, i) => ({
    id: `template-note-${i + 1}`,
    title: n.title,
    text: n.text,
    author: TEMPLATE_NOTE_AUTHOR,
    by: TEMPLATE_NOTE_SIGNER,
    at: now - i * 1000,
    color: n.color,
  }));
  return pinned.reverse();
}
