'use client';

// How much room the top-left menu card has, ending a strip's gap short of the palette strip
// (docs/specs/007-editor/toolbar-layout.md "The tab's name"). A crowded strip moves to the right (useStripCrowded),
// and on a tablet or a narrow window (640 to 1024px) the card steps down to fit what is left (useMenuCardFit). Where
// the strip is centred with room to spare (the usual case) the room is wider than the card and changes nothing.
import { useLayoutEffect, useState, type RefObject } from 'react';
import { STRIP_MENU_GAP_PX } from '../canvas/menu-join';
import type { MenuCardForm } from './menu-card-form';
import { usePaletteStripBox } from './PaletteTray';

/** The card's room, in screen px, or null where nothing limits it (no strip in the card's row, or `enabled` off). */
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

/** What the box takes on screen in each form, in px (null until measured in that form). */
export type MenuCardFixed = { full: number | null; icon: number | null };

/** The form that fits `room` (null: nothing caps the box): whole while the whole box fits, then the mode switch's icon
 *  alone (livediagram's), then bare. A form not measured yet is tried. Whole wherever the box fits whole: the strip
 *  stays centred there (it goes by the same width). */
export function menuCardFormFor(room: number | null, fixed: MenuCardFixed): MenuCardForm {
  if (room === null) return 'full';
  if (fixed.full === null || room >= fixed.full) return 'full';
  if (fixed.icon === null || room >= fixed.icon) return 'icon';
  return 'bare';
}

/** The box's form (menu-card-form.ts) beside the strip. Nothing in the box gives way since the tab's name left it
 *  (Work Tracker 1289), so nothing is capped: the button and the mode switch keep their size whatever the room. The
 *  strip goes by the box's whole width (`data-menu-natural-width`, kept from its last `full` form, read by
 *  menuNaturalRight), so a compact form never moves the strip, and the two never feed back on each other. The box's
 *  owner sets `data-menu-form`. */
export function useMenuCardFit(
  card: RefObject<HTMLElement | null>,
  enabled: boolean,
): { form: MenuCardForm } {
  const room = useMenuCardRoom(card, enabled);
  const [fixed, setFixed] = useState<MenuCardFixed>({ full: null, icon: null });
  const form = enabled ? menuCardFormFor(room, fixed) : 'full';
  // What the drawn form takes, measured as it lands and again as the box's parts resize (a mode's name changing the
  // switch's width). Bare is the last form, with nothing to measure it against.
  useLayoutEffect(() => {
    const el = card.current;
    if (!enabled || !el || form === 'bare') return;
    const slot = form;
    const measure = () => {
      const need = Math.ceil(el.getBoundingClientRect().width);
      // Whole, also the box's own width as the strip goes by it; compact forms keep the last one.
      if (slot === 'full') el.setAttribute('data-menu-natural-width', String(need));
      setFixed((prev) => (prev[slot] === need ? prev : { ...prev, [slot]: need }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(measure);
    for (const part of el.children) resize.observe(part);
    return () => resize.disconnect();
  }, [enabled, card, form, room]);
  return { form };
}
