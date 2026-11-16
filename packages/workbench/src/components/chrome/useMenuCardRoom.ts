'use client';

// How wide the top-left menu card may grow and still end a strip's gap short of the palette strip
// (docs/specs/007-editor/toolbar-layout.md "The tab's name"). A crowded strip moves to the right (useStripCrowded),
// but on a tablet or a narrow window (640 to 1024px) even there it reached back over a long tab name in the card: the
// card holds the menu button, the mode switch and the tab's name, and only the name can give way. Capped at the room
// left of the strip, the name truncates with an ellipsis instead of being cut by the strip. Where the strip is
// centred with room to spare (the usual case) the cap is wider than the card and changes nothing.
import { useLayoutEffect, useState, type RefObject } from 'react';
import { STRIP_MENU_GAP_PX } from '../canvas/menu-join';
import { usePaletteStripBox } from './PaletteTray';

/** The card's widest, in screen px, or null where nothing caps it (no strip in the card's row, or `enabled` off). */
export function useMenuCardRoom(
  card: RefObject<HTMLElement | null>,
  enabled: boolean,
): number | null {
  // Follows the strip as it resizes or moves (watchMove), the crowded flip included.
  const strip = usePaletteStripBox(enabled);
  const [cardBox, setCardBox] = useState<{ left: number; bottom: number } | null>(null);
  // Where the card stands, measured again whenever the strip does (a split moving the editor moves both).
  useLayoutEffect(() => {
    const el = card.current;
    if (!enabled || !el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setCardBox((prev) =>
        prev && prev.left === r.left && prev.bottom === r.bottom
          ? prev
          : { left: r.left, bottom: r.bottom },
      );
    };
    measure();
  }, [enabled, card, strip]);
  if (!enabled || !strip || !cardBox) return null;
  // Only a strip in the card's row: one lower down never meets it.
  if (strip.top >= cardBox.bottom) return null;
  return Math.max(0, Math.floor(strip.left - STRIP_MENU_GAP_PX - cardBox.left));
}
