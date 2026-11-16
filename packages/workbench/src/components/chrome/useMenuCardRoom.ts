'use client';

// How wide the top-left menu card may grow and still end a strip's gap short of the palette strip
// (docs/specs/007-editor/toolbar-layout.md "The tab's name"). A crowded strip moves to the right (useStripCrowded),
// but on a tablet or a narrow window (640 to 1024px) even there it reached back over a long tab name in the card: the
// card holds the menu button, the mode switch and the tab's name, and only the name can give way. Capped at the room
// left of the strip, the name truncates with an ellipsis instead of being cut by the strip. Where the strip is
// centred with room to spare (the usual case) the cap is wider than the card and changes nothing.
import { useLayoutEffect, useState, type RefObject } from 'react';
import { menuNaturalRight, STRIP_MENU_GAP_PX } from '../canvas/menu-join';
import type { MenuCardForm } from './menu-card-form';
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

/** The narrowest readable slot for the tab's name, in screen px: below it the name is hidden, never a sliver. */
export const NAME_SLOT_MIN_PX = 64;

/** What the box needs beside the name, in screen px, in each form (null until measured in that form). */
export type MenuCardFixed = { full: number | null; icon: number | null };

/** The form that fits `room` (null: nothing caps the box): whole while the button, the named mode switch and a
 *  readable name slot fit, then the mode switch's icon alone, then no name. A form not measured yet is tried. */
export function menuCardFormFor(room: number | null, fixed: MenuCardFixed): MenuCardForm {
  if (room === null) return 'full';
  if (fixed.full === null || room >= fixed.full + NAME_SLOT_MIN_PX) return 'full';
  if (fixed.icon === null || room >= fixed.icon + NAME_SLOT_MIN_PX) return 'icon';
  return 'bare';
}

/** The box's cap (`maxWidth`, screen px, null for none) and its form (menu-card-form.ts). The strip goes by the box's
 *  whole width (`data-menu-natural-width`, kept from its last `full` form, read by menuNaturalRight), so neither the
 *  cap nor a compact form moves the strip, and the two never feed back on each other. Bare, nothing is capped: the
 *  button and the mode switch's icon keep their size whatever the room. The box's owner sets `data-menu-form`. */
export function useMenuCardFit(
  card: RefObject<HTMLElement | null>,
  enabled: boolean,
): { maxWidth: number | null; form: MenuCardForm } {
  const room = useMenuCardRoom(card, enabled);
  const [fixed, setFixed] = useState<MenuCardFixed>({ full: null, icon: null });
  const form = enabled ? menuCardFormFor(room, fixed) : 'full';
  // What the drawn form needs beside the name, measured as it lands and again as the box's parts resize (a mode's
  // name changing the switch's width).
  useLayoutEffect(() => {
    const el = card.current;
    // Bare, the name is hidden and the box lacks the gap before it: measured only while the name shows, so a bare
    // box's width never reads as the icon form's need and flips it back (Work Tracker 1038).
    if (!enabled || !el || form === 'bare') return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const name = el.querySelector<HTMLElement>(':scope > [data-tab-name-in-box]');
      // Up to where the name starts, plus the box's own end (padding and border): what the button and the switch take
      // whatever the cap, which may squeeze the name to its padding but never moves its start.
      const style = getComputedStyle(el);
      const end =
        ((parseFloat(style.paddingRight) || 0) + (parseFloat(style.borderRightWidth) || 0)) *
        (el.offsetWidth > 0 ? box.width / el.offsetWidth : 1);
      const need = Math.ceil(
        name && name.offsetWidth > 0
          ? name.getBoundingClientRect().left - box.left + end
          : box.width,
      );
      if (form === 'full') {
        el.setAttribute(
          'data-menu-natural-width',
          String(Math.ceil(menuNaturalRight(el) - box.left)),
        );
      }
      const slot = form;
      setFixed((prev) => (prev[slot] === need ? prev : { ...prev, [slot]: need }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(measure);
    for (const part of el.children) resize.observe(part);
    return () => resize.disconnect();
  }, [enabled, card, form, room]);
  return { maxWidth: form === 'bare' ? null : room, form };
}
