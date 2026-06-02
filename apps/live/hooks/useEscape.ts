'use client';

import { useEffect, useRef } from 'react';

// Fire `onEscape` when the user presses the Escape key. Sibling to
// `useClickOutside`: most modal / popover surfaces in the editor
// pair "Escape closes" with "click-outside closes", and the
// useEffect to wire up each was being open-coded in every one. Five
// surfaces today (SettingsDialog, ImagePicker, ShortcutsDialog,
// SearchPanel, DeleteAccountDialog) plus three more that combine
// Escape with a click-outside handler in the same useEffect (left
// alone for now; splitting them is a separate concern).
//
// Options:
//   `enabled` (default true): when false, no listener is registered.
//      Used by DeleteAccountDialog to suppress Escape mid-submit so
//      the user can't cancel a request that's already in flight.
//   `capture` (default false): when true, register on `window` in
//      the capture phase so the surface fires BEFORE the editor's
//      global shortcuts at `document` bubble. Used by ShortcutsDialog
//      and SearchPanel which need Escape to be theirs alone, even
//      though the editor maps Escape to "deselect current element".
//   `stopPropagation` (default false): call e.stopPropagation() on
//      the captured event so the global listener (which is still
//      registered, just lost the race) doesn't fire too.
//
// `onEscape` is captured through a ref so the hook doesn't re-bind
// the listener on every render that produces a fresh callback
// identity (same trick as useClickOutside).

type UseEscapeOptions = {
  enabled?: boolean;
  capture?: boolean;
  stopPropagation?: boolean;
};

export function useEscape(onEscape: () => void, options: UseEscapeOptions = {}): void {
  const { enabled = true, capture = false, stopPropagation = false } = options;
  const cbRef = useRef(onEscape);
  useEffect(() => {
    cbRef.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    const target: EventTarget = capture ? window : document;
    const handler = (e: Event) => {
      if (!(e instanceof KeyboardEvent) || e.key !== 'Escape') return;
      if (stopPropagation) e.stopPropagation();
      cbRef.current();
    };
    target.addEventListener('keydown', handler, capture);
    return () => target.removeEventListener('keydown', handler, capture);
  }, [enabled, capture, stopPropagation]);
}
