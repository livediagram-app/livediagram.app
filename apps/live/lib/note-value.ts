// The canonical stored form of an element note (spec/92).
//
// A note is two fields that must never drift: `note`, the trimmed plain-text
// mirror every legacy reader uses, and `noteRich`, the formatting runs. This
// module is the ONE place that decides what the pair looks like for a given
// editor value, so the writer (`setNote`) and the change detection that
// decides which telemetry event to emit can't disagree about whether an edit
// actually changed anything.

import {
  hasRichFormatting,
  runsFromPlainText,
  runsPlainText,
  trimRuns,
  type TextRun,
} from '@livediagram/diagram';

export type NoteFields = {
  // Empty string means "no note" — the caller strips both fields.
  note: string;
  // Absent when the note carries no formatting, so an unformatted note
  // round-trips exactly as it did before rich notes existed.
  noteRich?: TextRun[];
};

/**
 * Normalise an editor value into the fields to store. `runs` carries the
 * formatting; `plain` is only used when there are no runs (a plain-text
 * caller, or a delete). Trimming runs on the RUNS, so the mirror is always
 * exactly `runsPlainText(noteRich)`.
 */
export function canonicalNote(plain: string, runs?: TextRun[]): NoteFields {
  const trimmed = trimRuns(runs && runs.length > 0 ? runs : runsFromPlainText(plain));
  const note = runsPlainText(trimmed);
  if (!note) return { note: '' };
  return hasRichFormatting(trimmed) ? { note, noteRich: trimmed } : { note };
}

/** Do two canonical note values differ in text, formatting, or both? */
export function noteFieldsEqual(a: NoteFields, b: NoteFields): boolean {
  return (
    a.note === b.note && JSON.stringify(a.noteRich ?? null) === JSON.stringify(b.noteRich ?? null)
  );
}
