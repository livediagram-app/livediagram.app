'use client';

import { useCallback, useEffect, useRef, type ChangeEvent } from 'react';

// Opening the photo picker exactly once per intent (spec/139 Phase 9).
//
// A file dialog is an OS window, and closing it can hand the page a stray
// click. On Linux/GTK a DOUBLE-CLICK on a filename closes the dialog on the
// first click and delivers the second to whatever now sits under the cursor —
// which, since the dialog was opened from a button, is often that button. The
// browser answers by opening a SECOND chooser, and the first one, already on
// its way back with a file, is discarded: no `change` event, no photo, nothing
// on screen. Selecting a file and pressing Open is one click, so it never
// showed the fault.
//
// So a pick is a state, not an event: while one dialog is out, asking again is
// ignored rather than served. Held in a ref because it is not something the UI
// renders — nothing on screen changes between "asked" and "answered".

export type PhotoPicker = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  open: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function usePhotoPicker(deps: {
  // Whether a photo may be started at all right now (the board's own rules).
  canOpen: () => boolean;
  onFile: (file: File) => void;
}): PhotoPicker {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(false);
  const live = useRef(deps);
  live.current = deps;

  // Dismissing the dialog without choosing fires no `change` — the window just
  // gets its focus back. Without this the picker would stay "pending" forever
  // and the button would be dead for the rest of the session.
  useEffect(() => {
    const done = () => {
      pendingRef.current = false;
    };
    window.addEventListener('focus', done);
    return () => window.removeEventListener('focus', done);
  }, []);

  const open = useCallback(() => {
    if (!live.current.canOpen()) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    inputRef.current?.click();
  }, []);

  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    pendingRef.current = false;
    const file = event.target.files?.[0];
    // Clear the input before doing anything with the file, so picking the SAME
    // photo again still fires a change (the value, not the file, is what the
    // browser compares).
    event.target.value = '';
    if (file) live.current.onFile(file);
  }, []);

  return { inputRef, open, onChange };
}
