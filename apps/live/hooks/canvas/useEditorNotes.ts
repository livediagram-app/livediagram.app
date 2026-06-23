// Per-element note popover, lifted out of editor-page.tsx. Notes are
// simpler than comments: a single plain-text paragraph, no author, no
// thread. The state machine is just an open-id (`noteOpenId`, null
// when no popover is open); the actual text lives on `element.note?`
// (see packages/diagram BoxedElement schema).
//
// Unlike comments (which bypass history on purpose), note edits run
// through the page's `commit` so they snapshot history + emit the
// activity log like any other element field. This hook only relocates
// that code, it doesn't change the contract.

import { useState } from 'react';
import { isBoxed, type Element } from '@livediagram/diagram';
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

  const setNote = (elementId: string, next: string) => {
    const trimmed = next.trim();
    // Empty / whitespace-only note: drop the field entirely so
    // persisted JSON stays clean and the badge / picker active
    // state correctly reads "no note".
    commit((els) =>
      els.map((el) => {
        if (el.id !== elementId || !isBoxed(el)) return el;
        if (!trimmed) {
          const { note: _drop, ...rest } = el;
          return rest as typeof el;
        }
        return { ...el, note: trimmed };
      }),
    );
  };

  return { noteOpenId, openNote, closeNote, setNote };
}
