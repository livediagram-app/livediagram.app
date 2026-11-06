// How the tool options card closes (docs/specs/031-photo/photo-pages.md "The options flyout"): a press anywhere
// outside it and the photo tools (the photo's own press, captured, closes it as the tool goes on to work), or Escape,
// which leaves the tool in hand. The desktop's card and a phone's bottom sheet close alike, and so does a phone's
// Layers sheet (photo-pages.md "The Photo panel"), through usePressOutsideDismiss.
import { useEffect, useRef } from 'react';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';

// A press in these is the card's, not outside it: the photo tools (a tool's button toggles the card itself) and the
// colours, and the popovers, pickers and menus the card opens.
export const TOOL_FLYOUT_INSIDE =
  '[data-photo-flyout], [data-photo-rail], [data-anchored-popover], [data-colour-picker], [data-photo-gradient-editor], [role="menu"]';

// Escape pressed in one of these is that surface's own (a popover closes, not the card under it).
const FLYOUT_ESCAPE_ELSEWHERE = '[data-anchored-popover]';

/**
 * Close a surface on a press outside it (anything matching `inside` is its own) or on Escape (unless the key was
 * pressed in something matching `escapeElsewhere`, which takes it itself). Both listen on the window in the capture
 * phase, before the photo's own press and keys, and Escape is claimed so it does one thing.
 */
export function usePressOutsideDismiss(
  active: boolean,
  inside: string,
  onClose: () => void,
  escapeElsewhere: string = FLYOUT_ESCAPE_ELSEWHERE,
): void {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest(inside)) return;
      close.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if ((e.target as Element | null)?.closest?.(escapeElsewhere)) return;
      e.preventDefault();
      e.stopPropagation();
      close.current();
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [active, inside, escapeElsewhere]);
}

export function useToolFlyoutDismiss(active: boolean, inside: string = TOOL_FLYOUT_INSIDE): void {
  // Before the photo's keys: Escape closes the card rather than putting the tool down.
  usePressOutsideDismiss(active, inside, closeToolFlyout);
}

function closeToolFlyout(): void {
  toolFlyout.close();
}
