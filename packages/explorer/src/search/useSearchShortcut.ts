'use client';

import { useEffect } from 'react';
import { useLatest } from '../ui/useLatest';

// The chords that open the Explorer's Search panel, Cmd/Ctrl+K and Cmd/Ctrl+. (the editors' command palette's,
// livediagram/docs/specs/007-editor/command-palette.md "Shortcut"; liveworkspace/docs/site.md "The Explorer"). Like the
// editors' chords they stand aside while the person is typing and while a dialog is open, so a chord pressed in a
// field or a dialog stays there.

/** Whether a key event is one of the two chords: Cmd or Ctrl with `K` or `.`, and no Alt. */
export function isSearchChord(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return false;
  return e.key === '.' || e.key.toLowerCase() === 'k';
}

/** Whether a key event's target is somewhere the person is typing: a text field, a text area, a select or editable
 *  text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable === true)
  );
}

/** Whether a dialog is open in the page: every Explorer dialog (and the Search panel itself) is `aria-modal`. Read
 *  only when a chord is pressed, so it costs nothing on any other key. */
export function dialogOpen(doc: Document = document): boolean {
  return doc.querySelector('[aria-modal="true"]') !== null;
}

/** Opens the Search panel on Cmd/Ctrl+K or Cmd/Ctrl+., except while typing, while a dialog is open, or when another
 *  handler already took the key. */
export function useSearchShortcut(onOpen: () => void): void {
  const open = useLatest(onOpen);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isSearchChord(e)) return;
      if (isTypingTarget(e.target) || dialogOpen()) return;
      e.preventDefault();
      open.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
}
