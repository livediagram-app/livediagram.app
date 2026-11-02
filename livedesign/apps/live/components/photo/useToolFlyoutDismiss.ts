// How the tool options card closes (docs/specs/031-photo/photo-pages.md "The options flyout"): a press anywhere
// outside it and the photo tools (the photo's own press, captured, closes it as the tool goes on to work), or Escape,
// which leaves the tool in hand. The desktop's card and a phone's bottom sheet close alike.
import { useEffect } from 'react';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';

// A press in these is the card's, not outside it: the photo tools (a tool's button toggles the card itself) and the
// colours, and the popovers, pickers and menus the card opens.
export const TOOL_FLYOUT_INSIDE =
  '[data-photo-flyout], [data-photo-rail], [data-anchored-popover], [data-colour-picker], [data-photo-gradient-editor], [role="menu"]';

export function useToolFlyoutDismiss(active: boolean, inside: string = TOOL_FLYOUT_INSIDE): void {
  useEffect(() => {
    if (!active) return;
    const down = (e: PointerEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest(inside)) return;
      toolFlyout.close();
    };
    // Before the photo's keys: Escape closes the card rather than putting the tool down.
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if ((e.target as Element | null)?.closest?.('[data-anchored-popover]')) return;
      e.preventDefault();
      e.stopPropagation();
      toolFlyout.close();
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [active, inside]);
}
