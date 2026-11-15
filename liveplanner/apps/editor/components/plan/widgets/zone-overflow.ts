'use client';

// A too-full widget zone (docs/specs/026-plan/board-widgets.md "The header", Work Tracker 880): the zone is one row
// that never scrolls; the widgets that do not fit go into More at its end, the Filter then holding the zone's start so
// it is always in the row. Which widgets fit is worked out from each widget's own width and the zone's room
// (fitWidgets, pure), so the same widths always give the same row and nothing flips back and forth. useZoneFit
// measures with one ResizeObserver; pressedIn reads which widgets hold a press, for More to name it.
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { nudgeWidget, type BoardWidgetId } from '@liveplanner/items';

// The widget that holds the zone's start while some widgets are in More.
export const PINNED_WIDGET: BoardWidgetId = 'filter';

// The gap between the zone's items, its `gap-1.5`.
export const ZONE_GAP_PX = 6;

// The most a pressed value's name takes on More (it is cut short past it). The fit reserves this much whenever a
// widget More would hold has a press, so the name's own width never feeds back into which widgets fit.
export const MORE_LABEL_MAX_PX = 120;

export type ZoneFit = {
  // Some widgets are in More.
  overflow: boolean;
  // The Filter holds the zone's start.
  pinned: boolean;
  // While overflowing, how many of the widgets after the pinned Filter the row holds, in order.
  shown: number;
  // What every widget and the buttons take across, all in the row: the width the zone asks for, so a zone sized by its
  // content (a header band's) is given the room it could have, however many widgets are in More.
  need: number;
};

export const FITS_ALL: ZoneFit = { overflow: false, pinned: false, shown: 0, need: 0 };

export type FitInput = {
  // The board's widgets, in order.
  order: readonly BoardWidgetId[];
  // Each widget's width, as drawn.
  widths: ReadonlyMap<BoardWidgetId, number>;
  // The zone's room across.
  room: number;
  // The widths of the zone's buttons after the widgets (the + and Edit Widgets), none for someone who may not edit.
  controls: readonly number[];
  // More's width, unpressed.
  more: number;
  // The widgets holding a press.
  pressed: ReadonlySet<BoardWidgetId>;
};

// Which widgets the row holds. Everything fits: no More. Otherwise the Filter pins (when the board has it) and the
// rest fill in order, as many as fit beside the Filter, More and the buttons; a widget is never skipped to fill a
// gap, so the row keeps the board's order. Linear in the widgets.
export function fitWidgets({ order, widths, room, controls, more, pressed }: FitInput): ZoneFit {
  const width = (k: BoardWidgetId) => widths.get(k) ?? 0;
  const buttons = controls.reduce((s, c) => s + c, 0);
  const all =
    order.reduce((s, k) => s + width(k), 0) +
    buttons +
    ZONE_GAP_PX * Math.max(0, order.length + controls.length - 1);
  if (all <= room + 0.5) return { ...FITS_ALL, need: all };
  const pinned = order.includes(PINNED_WIDGET);
  const rest = pinned ? order.filter((k) => k !== PINNED_WIDGET) : order;
  // Whether any widget from i on holds a press: More would then name it.
  const pressedFrom = new Array<boolean>(rest.length + 1).fill(false);
  for (let i = rest.length - 1; i >= 0; i--)
    pressedFrom[i] = pressedFrom[i + 1]! || pressed.has(rest[i]!);
  const fixed = (pinned ? width(PINNED_WIDGET) : 0) + buttons;
  const fixedItems = (pinned ? 1 : 0) + 1 + controls.length;
  let shown = 0;
  let prefix = 0;
  // At least one widget goes into More (with none, everything would have fit above). Each count is checked with the
  // More it would leave, so the largest that fits is taken even past one that does not.
  for (let k = 0; k < rest.length; k++) {
    const moreWidth = more + (pressedFrom[k] ? MORE_LABEL_MAX_PX : 0);
    if (fixed + moreWidth + prefix + ZONE_GAP_PX * (fixedItems + k - 1) <= room + 0.5) shown = k;
    prefix += width(rest[k]!);
  }
  return { overflow: true, pinned, shown, need: all };
}

export type ZoneLayout = {
  // The Filter holds the zone's start.
  pin: boolean;
  // The widgets the row holds after it, in order.
  row: readonly BoardWidgetId[];
  // The widgets in More, in order.
  hidden: readonly BoardWidgetId[];
};

// The row and More for a fit.
export function zoneLayout(widgets: readonly BoardWidgetId[], fit: ZoneFit): ZoneLayout {
  if (!fit.overflow) return { pin: false, row: widgets, hidden: [] };
  const pin = fit.pinned && widgets.includes(PINNED_WIDGET);
  const rest = pin ? widgets.filter((k) => k !== PINNED_WIDGET) : widgets;
  return { pin, row: rest.slice(0, fit.shown), hidden: rest.slice(fit.shown) };
}

// A drop slot among the row's widgets, as an index into the board's own list (placeWidget's): past the row's last, it
// lands before the first widget in More, so it stays in the row.
export function slotInList(
  widgets: readonly BoardWidgetId[],
  layout: Pick<ZoneLayout, 'row' | 'hidden'>,
  slot: number,
): number {
  if (slot < layout.row.length) return widgets.indexOf(layout.row[slot]!);
  return layout.hidden.length ? widgets.indexOf(layout.hidden[0]!) : widgets.length;
}

// Alt+← or Alt+→ on a widget after the pinned Filter (in the row or in More): it passes its neighbour, the pinned
// Filter keeping its place in the board's list.
export function nudgeInRow(
  widgets: readonly BoardWidgetId[],
  kind: BoardWidgetId,
  delta: -1 | 1,
  pinned: boolean,
): BoardWidgetId[] {
  const at = widgets.indexOf(PINNED_WIDGET);
  if (!pinned || at < 0) return nudgeWidget(widgets, kind, delta);
  const next = nudgeWidget(
    widgets.filter((k) => k !== PINNED_WIDGET),
    kind,
    delta,
  );
  next.splice(at, 0, PINNED_WIDGET);
  return next;
}

// The presses each widget inside `root` holds: the names its `[data-widget-pressed]` parts carry, in the order drawn.
// A query, no layout read.
export function pressedIn(root: ParentNode | null): Map<BoardWidgetId, string[]> {
  const out = new Map<BoardWidgetId, string[]>();
  if (!root) return out;
  for (const el of root.querySelectorAll<HTMLElement>('[data-widget-pressed]')) {
    const kind = el.closest<HTMLElement>('[data-widget]')?.dataset['widget'];
    const name = el.dataset['widgetPressed'];
    if (!kind || !name) continue;
    out.set(kind as BoardWidgetId, [...(out.get(kind as BoardWidgetId) ?? []), name]);
  }
  return out;
}

// What More names for the widgets it holds: the first press among them (in their order), with "+n" for the rest.
export function moreLabel(
  hidden: readonly BoardWidgetId[],
  pressed: ReadonlyMap<BoardWidgetId, readonly string[]>,
): string | null {
  const names = hidden.flatMap((k) => pressed.get(k) ?? []);
  if (names.length === 0) return null;
  return names.length === 1 ? names[0]! : `${names[0]} +${names.length - 1}`;
}

const sameFit = (a: ZoneFit, b: ZoneFit) =>
  a.overflow === b.overflow &&
  a.pinned === b.pinned &&
  a.shown === b.shown &&
  Math.abs(a.need - b.need) < 0.5;

// Measures the zone: the room it has, each widget's width wherever it is drawn (the row, the pinned Filter, the
// measuring layer), the buttons and the ghost More, with one ResizeObserver that is re-pointed when the row changes.
// Each callback works the fit out again and sets state only when it changes. The presses come in from the caller
// (read after every render), so a press that moves a widget's need for a label refits too. Room 0 (the zone not laid
// out: a hidden tab, jsdom) keeps the last fit.
export function useZoneFit(
  zone: RefObject<HTMLElement | null>,
  widgets: readonly BoardWidgetId[],
  pressed: ReadonlySet<BoardWidgetId>,
): ZoneFit {
  const [fit, setFit] = useState<ZoneFit>(FITS_ALL);
  const now = useRef(fit);
  const pressedRef = useRef(pressed);
  pressedRef.current = pressed;
  const measureRef = useRef<() => void>(() => {});
  const key = widgets.join();
  const pressedKey = [...pressed].join();
  useLayoutEffect(() => {
    const z = zone.current;
    if (!z) return;
    const measure = () => {
      const room = z.clientWidth;
      if (room <= 0) return;
      const widths = new Map<BoardWidgetId, number>();
      for (const el of z.querySelectorAll<HTMLElement>('[data-widget]')) {
        const kind = el.dataset['widget'] as BoardWidgetId;
        if (!widths.has(kind)) widths.set(kind, el.offsetWidth);
      }
      const controls = [...z.querySelectorAll<HTMLElement>('[data-widget-control]')].map(
        (el) => el.offsetWidth,
      );
      const more = z.querySelector<HTMLElement>('[data-widget-more-ghost]')?.offsetWidth ?? 0;
      const next = fitWidgets({
        order: widgets,
        widths,
        room,
        controls,
        more,
        pressed: pressedRef.current,
      });
      if (sameFit(next, now.current)) return;
      now.current = next;
      setFit(next);
    };
    measureRef.current = measure;
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const seen = new ResizeObserver(() => measureRef.current());
    seen.observe(z);
    for (const el of z.querySelectorAll<HTMLElement>(
      '[data-widget], [data-widget-control], [data-widget-more-ghost]',
    ))
      seen.observe(el);
    return () => seen.disconnect();
    // Re-pointed as the widgets, the fit (which moves them between the row and the measuring layer) or the presses
    // change.
    // oxlint-disable-next-line react/exhaustive-deps -- `key` stands for `widgets`
  }, [zone, key, fit, pressedKey]);
  return fit;
}
