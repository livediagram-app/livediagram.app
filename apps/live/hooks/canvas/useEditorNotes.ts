// Per-element note popover, lifted out of editor-page.tsx. Notes are
// simpler than comments: one small document per element, no author, no
// thread. The state machine is just an open-id (`noteOpenId`, null when no
// popover is open); the content lives on the element as `note?` (the
// plain-text mirror) plus `noteRich?` (its formatting runs, spec/92) — see
// packages/diagram BoxedElement.
//
// Unlike comments (which bypass history on purpose), note edits run
// through the page's `commit` so they snapshot history + emit the
// activity log like any other element field.

import { useState } from 'react';
import { isBoxed, type Element, type TextRun } from '@livediagram/diagram';
import { canonicalNote } from '@/lib/note-value';
import { track } from '@/lib/telemetry';

type EditorNotesDeps = {
  // The history-aware element mutator. Note edits push a snapshot,
  // same as any other element-field change.
  commit: (mapElements: (els: Element[]) => Element[]) => void;
};

export function useEditorNotes(deps: EditorNotesDeps) {
  const { commit } = deps;
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);

  // Toggle open / closed: clicking the same id again closes the
  // popover (matches the comment popover behaviour). Read the
  // current value from closure before flipping so the telemetry
  // emit only fires on open transitions, never on close, and never
  // double-fires under React strict mode (which would re-run an
  // updater-internal side effect).
  const openNote = (elementId: string) => {
    const wasOpen = noteOpenId === elementId;
    setNoteOpenId((cur) => (cur === elementId ? null : elementId));
    if (!wasOpen) track('Note', 'Opened');
  };
  const closeNote = () => setNoteOpenId(null);

  // `runs` carries the formatting; `next` is its plain-text mirror. Both are
  // normalised through `canonicalNote` so the stored pair can't drift.
  const setNote = (elementId: string, next: string, runs?: TextRun[]) => {
    const { note, noteRich } = canonicalNote(next, runs);
    // Empty / whitespace-only note: drop BOTH fields entirely so persisted
    // JSON stays clean and the badge / picker active state correctly reads
    // "no note".
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || !isBoxed(el)) return el;
        const { note: _dropNote, noteRich: _dropRuns, ...rest } = el;
        if (!note) return rest as typeof el;
        return (noteRich ? { ...rest, note, noteRich } : { ...rest, note }) as typeof el;
      }),
    );
  };

  return { noteOpenId, openNote, closeNote, setNote };
}
