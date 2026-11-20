// Nothing in view (liveworkspace/docs/specs/016-notifications/toasts.md "Timing"): while every element on the tab has
// scrolled out of view (see useOffscreenContent), a standing info toast, "Nothing in view" with Show All, which fits
// the tab to the screen as the Fit button does. Mounted by CanvasChrome while it holds; it draws nothing itself. It
// leaves when this unmounts (something is back in view); closed, it stays away for the rest of this spell.

import { useEffect, useRef } from 'react';
import { useToast } from '../../hooks/ui/useToast';

export const OFFSCREEN_TOAST_KEY = 'nothing-in-view';

type OffscreenContentHintProps = {
  // Bring everything back into view (wired to fit-to-screen).
  onBringBack: () => void;
};

export function OffscreenContentHint({ onBringBack }: OffscreenContentHintProps) {
  const toast = useToast();
  // The latest handler, so a new one does not re-raise the toast.
  const bringBack = useRef(onBringBack);
  useEffect(() => {
    bringBack.current = onBringBack;
  });
  const closed = useRef(false);
  useEffect(() => {
    if (closed.current) return;
    toast.action({
      key: OFFSCREEN_TOAST_KEY,
      message: 'Nothing in view',
      sticky: true,
      actions: [{ label: 'Show All', onSelect: () => bringBack.current() }],
      onDismiss: () => {
        closed.current = true;
      },
    });
    return () => toast.dismissAction(OFFSCREEN_TOAST_KEY);
  }, [toast]);
  return null;
}
