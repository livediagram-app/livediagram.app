'use client';

import { useCallback, useEffect, useRef, type ChangeEvent } from 'react';

// Opening the photo picker exactly once per intent (spec/139 Phase 9).
//
// A file dialog is an OS window, and closing it can hand the page a stray
// click: it lands on whatever now sits under the cursor, which — since the
// dialog was opened from a button — is often that button. The browser answers
// by opening a SECOND chooser, and the first one, already on its way back with
// a file, is discarded: no `change` event, no photo, nothing on screen.
//
// NOT to be confused with the Chrome-on-Linux double-click fault this was first
// written to chase (spec/139): that one is Chromium setting its GTK dialog's
// default response to Cancel, so a double-click activates Cancel and the file
// never reaches any page. No page code can fix that one; this guard is for the
// stray click, which page code can.
//
// So a pick is a state, not an event: while one dialog is out, asking again is
// ignored rather than served. Held in a ref because it is not something the UI
// renders — nothing on screen changes between "asked" and "answered".

// How long after a dialog closes the picker keeps ignoring requests. Long
// enough to cover the stray click of a double-click, short enough that a person
// deliberately re-opening it never notices.
const PICKER_SETTLE_MS = 500;

export type PhotoPicker = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  open: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function usePhotoPicker(deps: {
  // Whether a photo may be started at all right now (the board's own rules).
  canOpen: () => boolean;
  onFile: (file: File) => void;
  // A pick has begun: work that the file will need (the boundary model's
  // runtime) can load while the author is still choosing.
  onOpen?: () => void;
}): PhotoPicker {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pendingRef = useRef(false);
  const releaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef(deps);
  live.current = deps;

  // The lock outlives the dialog CLOSING, and that beat is the entire point.
  // Chrome on Linux delivers a double-click as:
  //
  //   dialog closes → window FOCUS → the stray second click → change
  //
  // so a lock released on focus is released a moment before the click it
  // exists to ignore — which is how the first version of this guard still let
  // the second click open a fresh chooser and throw the file away. Anything
  // that says "the dialog is gone" instead starts this short settle, and only
  // after it does the picker answer again.
  const release = useCallback(() => {
    if (releaseRef.current !== null) clearTimeout(releaseRef.current);
    releaseRef.current = setTimeout(() => {
      pendingRef.current = false;
      releaseRef.current = null;
    }, PICKER_SETTLE_MS);
  }, []);

  // Dismissing the dialog without choosing fires no `change` at all — the
  // window just gets its focus back. Without this the picker would stay
  // "pending" forever and the button would be dead for the rest of the session.
  useEffect(() => {
    window.addEventListener('focus', release);
    return () => {
      window.removeEventListener('focus', release);
      if (releaseRef.current !== null) clearTimeout(releaseRef.current);
    };
  }, [release]);

  const open = useCallback(() => {
    if (!live.current.canOpen()) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    live.current.onOpen?.();
    inputRef.current?.click();
  }, []);

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      // Through the same settle: a stray click landing just AFTER the file has
      // been delivered would otherwise pop a second dialog over the review that
      // is opening.
      release();
      const file = event.target.files?.[0];
      // Clear the input before doing anything with the file, so picking the SAME
      // photo again still fires a change (the value, not the file, is what the
      // browser compares).
      event.target.value = '';
      if (file) live.current.onFile(file);
    },
    [release],
  );

  return { inputRef, open, onChange };
}
