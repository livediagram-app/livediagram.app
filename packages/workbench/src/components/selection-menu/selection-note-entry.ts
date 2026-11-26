// Comment and Add Action in the selection menu (liveworkspace/docs/specs/004-index/send-to-plan.md "The selection
// menu"): an app that puts notes on words while they are read (liveknowledge's "Comments on the writing") registers
// what they do here, and the menu shows the two rows only while it says these words may take a note. A module-level
// relay, as the send entries are: one editor runs per page.

export type SelectionNoteKind = 'comment' | 'action';

export type SelectionNoteEntry = {
  /** Whether the words picked in this writing may take a note now (the session's role, the page, where they are). */
  canNote: (writing: HTMLElement) => boolean;
  /** Puts a note of this kind on the words picked in this writing, and opens it. */
  note: (kind: SelectionNoteKind, writing: HTMLElement) => void;
};

let entry: SelectionNoteEntry | null = null;

/** Registers the app's entry (null takes it away); answers the unregister. */
export function setSelectionNoteEntry(next: SelectionNoteEntry | null): () => void {
  entry = next;
  return () => {
    if (entry === next) entry = null;
  };
}

/** The verb for a note of `kind` on these words, or null where none may be put. */
export function selectionNoteVerb(
  writing: HTMLElement,
  kind: SelectionNoteKind,
): (() => void) | null {
  const e = entry;
  if (!e || !e.canNote(writing)) return null;
  return () => e.note(kind, writing);
}

/** Whether these words may take a note at all (the menu opens for it where the session sends nothing). */
export const canNoteHere = (writing: HTMLElement): boolean => !!entry?.canNote(writing);
