'use client';

// How a board header's card type chips show (docs/specs/026-plan/plan-board.md "Card type chips", Work Tracker 1086):
// named, as their little cards alone, or left out, never squeezed or clipped. They come before the widgets for room:
// the room they have is everything from their start to the widget zone, plus whatever the zone holds past its
// narrowest (zoneMinWidth, published on the zone as `data-widget-zone-min`), stopping short of a header band's palette
// strip. That room does not change with the chips' own width (what they give up goes to the zone
// or the header's free space, both counted), so a mode never flips back and forth.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

export type ChipsMode = 'named' | 'compact' | 'none';

// The header's gap between the chips and what follows them (its `gap-3`).
export const CHIPS_GAP_PX = 12;
// The palette strip's parts (canvas-layer-insets.ts's strip), shown.
const STRIP_PARTS = '[data-toolbar-palette]:not(.hidden) > *';

// The mode for `room`: named when they may be named (CHIP_NAMES_MAX) and fit so, else their little cards when those
// fit, else none.
export function chipsMode(
  room: number,
  named: number,
  compact: number,
  canName: boolean,
): ChipsMode {
  if (canName && named <= room + 0.5) return 'named';
  if (compact <= room + 0.5) return 'compact';
  return 'none';
}

// The chips' room, in px: from their start to where the zone's part of the header starts (less the gap), plus the
// zone's surplus over its narrowest, and no more than `cap`.
export function chipsRoom(input: {
  rowLeft: number;
  targetLeft: number;
  surplus: number;
  cap: number;
}): number {
  const { rowLeft, targetLeft, surplus, cap } = input;
  // A negative surplus (the zone squeezed under its narrowest, by the chips themselves) takes room back.
  return Math.min(targetLeft - rowLeft - CHIPS_GAP_PX + surplus, cap);
}

// Reads the room off the header and the chips' two widths off their measuring layer (`data-chips-named-ghost`,
// `data-chips-compact-ghost`), with one ResizeObserver on the header, the chips' container, the zone, its part of the
// header and the menu box (a band's title riding there moves the chips without resizing the header). State is set only on a change of
// mode. Nothing laid out (jsdom, a hidden tab): the mode stays as it is.
export function useChipsFit(
  row: RefObject<HTMLElement | null>,
  canName: boolean,
  key: string,
): ChipsMode {
  const [mode, setMode] = useState<ChipsMode>(canName ? 'named' : 'compact');
  const now = useRef(mode);
  useLayoutEffect(() => {
    const r = row.current;
    const header = r?.closest<HTMLElement>('[data-board-header]');
    if (!r || !header) return;
    const zoneNow = () => header.querySelector<HTMLElement>('[data-widget-zone-min]');
    const targetOf = (zone: HTMLElement | null) =>
      zone
        ? (zone.closest<HTMLElement>('[data-band-controls]') ?? zone.parentElement ?? zone)
        : header.querySelector<HTMLElement>('[data-band-controls]');
    const measure = () => {
      const named = r.querySelector<HTMLElement>('[data-chips-named-ghost]')?.offsetWidth ?? 0;
      const compact = r.querySelector<HTMLElement>('[data-chips-compact-ghost]')?.offsetWidth ?? 0;
      if (compact <= 0) return;
      const zone = zoneNow();
      const target = targetOf(zone);
      if (!target) return;
      const rowLeft = r.getBoundingClientRect().left;
      // A header band's palette strip, moved to the header's right end before its controls: the chips stop short of it.
      // (Never the band's middle width: that is measured with the widgets all in the row, which give way first.)
      const box = header.getBoundingClientRect();
      let cap = Infinity;
      for (const el of document.querySelectorAll<HTMLElement>(STRIP_PARTS)) {
        const b = el.getBoundingClientRect();
        const mid = (b.top + b.bottom) / 2;
        if (b.width > 0 && b.left > rowLeft && mid > box.top && mid < box.bottom)
          cap = Math.min(cap, b.left - rowLeft - CHIPS_GAP_PX);
      }
      const surplus = zone ? zone.clientWidth - Number(zone.dataset['widgetZoneMin'] ?? 0) : 0;
      const next = chipsMode(
        chipsRoom({ rowLeft, targetLeft: target.getBoundingClientRect().left, surplus, cap }),
        named,
        compact,
        canName,
      );
      if (next === now.current) return;
      now.current = next;
      setMode(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const seen = new ResizeObserver(measure);
    const zone = zoneNow();
    for (const el of [
      header,
      // The chips' container: a band's middle, which follows the band without the header resizing.
      r.parentElement,
      zone,
      targetOf(zone),
      document.querySelector<HTMLElement>('[data-toolbar-menu]'),
    ])
      if (el) seen.observe(el);
    return () => seen.disconnect();
  }, [row, canName, key]);
  return canName || mode !== 'named' ? mode : 'compact';
}
