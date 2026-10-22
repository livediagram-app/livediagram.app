'use client';

// A slot's text being typed (a note's, a title's): kept locally while it is worked on, landing as one step when the
// field is left, and following the stored value when it changes from elsewhere (a collaborator, an undo) while
// nothing is waiting to be saved.
import { useState } from 'react';

export function useSlotDraft(stored: string): [string, (next: string) => void] {
  const [draft, setDraft] = useState(stored);
  const [seen, setSeen] = useState(stored);
  // Adjusted during render: the stored value moved on, so the draft follows it unless it holds unsaved typing.
  if (seen !== stored) {
    setSeen(stored);
    if (draft === seen) setDraft(stored);
  }
  return [draft, setDraft];
}
