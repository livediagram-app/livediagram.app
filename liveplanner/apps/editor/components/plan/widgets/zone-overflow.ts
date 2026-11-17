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

// What a pressed More takes when the room cannot hold its name: a dot in the brand colour.
export const MORE_DOT_PX = 12;

// How the Filter sits while some widgets are in More: whole at the zone's start, as one button there (compact), or in
// More with the rest (when not even the button fits beside More and the zone's buttons).
export type FilterPlace = 'whole' | 'compact' | 'more';

export type ZoneFit = {
  // Some widgets are in More.
  overflow: boolean;
  // The Filter holds the zone's start (whole or compact).
  pinned: boolean;
  // How the Filter sits; 'whole' while nothing overflows or the board has no Filter.
  filter: FilterPlace;
  // While overflowing, how many of the widgets after the pinned Filter (or of all of them, the Filter in More) the
  // row holds, in order.
  shown: number;
  // More names the press it holds (else a dot says one is there).
  named: boolean;
  // What every widget and the buttons take across, all in the row: the width the zone asks for, so a zone sized by its
  // content (a header band's) is given the room it could have, however many widgets are in More.
  need: number;
};

export const FITS_ALL: ZoneFit = {
  overflow: false,
  pinned: false,
  filter: 'whole',
  shown: 0,
  named: true,
  need: 0,
};

export type FitInput = {
  // The board's widgets, in order.
  order: readonly BoardWidgetId[];
  // Each widget's width, as drawn (the Filter's whole).
  widths: ReadonlyMap<BoardWidgetId, number>;
  // The zone's room across.
  room: number;
  // The widths of the zone's buttons after the widgets (the + and Edit Widgets), none for someone who may not edit.
  controls: readonly number[];
  // More's width, unpressed.
  more: number;
  // The compact Filter's width.
  compact: number;
  // The widgets holding a press.
  pressed: ReadonlySet<BoardWidgetId>;
};

// Which widgets the row holds. Everything fits: no More. Otherwise, in order of preference, each step taken only when
// the one before cannot fit even with no widget in the row beside it:
// 1. the whole Filter pins at the zone's start and the rest fill in order beside More (naming a press it holds) and
//    the buttons;
// 2. the Filter pins compact (one button), More naming its press;
// 3. the Filter pins compact, More marking its press with a dot;
// 4. the Filter goes into More with the rest, More naming its press, then with a dot.
// A widget is never skipped to fill a gap, so the row keeps the board's order; nothing ever clips or overlaps what is
// before the zone, short of a room under the narrowest step (More and the buttons alone). Linear in the widgets.
export function fitWidgets(input: FitInput): ZoneFit {
  const { order, widths, room, controls, more, compact, pressed } = input;
  const width = (k: BoardWidgetId) => widths.get(k) ?? 0;
  const buttons = controls.reduce((s, c) => s + c, 0);
  const all =
    order.reduce((s, k) => s + width(k), 0) +
    buttons +
    ZONE_GAP_PX * Math.max(0, order.length + controls.length - 1);
  if (all <= room + 0.5) return { ...FITS_ALL, need: all };
  // The most widgets of `rest` the row holds beside a pinned Filter `pin` px wide (none: no pin), More (named or with
  // a dot) and the buttons; -1 when not even none fit. At least one widget goes into More.
  const best = (rest: readonly BoardWidgetId[], pin: number | null, named: boolean): number => {
    const pressedFrom = new Array<boolean>(rest.length + 1).fill(false);
    for (let i = rest.length - 1; i >= 0; i--)
      pressedFrom[i] = pressedFrom[i + 1]! || pressed.has(rest[i]!);
    const fixed = (pin ?? 0) + buttons;
    const fixedItems = (pin === null ? 0 : 1) + 1 + controls.length;
    let shown = -1;
    let prefix = 0;
    // Each count is checked with the More it would leave, so the largest that fits is taken even past one that does
    // not.
    for (let k = 0; k < rest.length; k++) {
      const mark = pressedFrom[k] ? (named ? MORE_LABEL_MAX_PX : MORE_DOT_PX) : 0;
      if (fixed + more + mark + prefix + ZONE_GAP_PX * (fixedItems + k - 1) <= room + 0.5)
        shown = k;
      prefix += width(rest[k]!);
    }
    return shown;
  };
  const fit = (pinned: boolean, filter: FilterPlace, shown: number, named: boolean): ZoneFit => ({
    overflow: true,
    pinned,
    filter,
    shown,
    named,
    need: all,
  });
  if (order.includes(PINNED_WIDGET)) {
    const rest = order.filter((k) => k !== PINNED_WIDGET);
    const steps: [FilterPlace, number, boolean][] = [
      ['whole', width(PINNED_WIDGET), true],
      ['compact', compact, true],
      ['compact', compact, false],
    ];
    for (const [place, pin, named] of steps) {
      const shown = best(rest, pin, named);
      if (shown >= 0) return fit(true, place, shown, named);
    }
  }
  const filter: FilterPlace = order.includes(PINNED_WIDGET) ? 'more' : 'whole';
  for (const named of [true, false]) {
    const shown = best(order, null, named);
    if (shown >= 0) return fit(false, filter, shown, named);
  }
  return fit(false, filter, 0, false);
}

// The least the zone takes across at its narrowest kept step (the Filter compact, More with its dot, the buttons; no
// Filter: More and the buttons), or every widget when that is less. The header's card type chips give way only past it
// (use-chips-fit.ts, plan-board.md "Card type chips"): the widgets go into More first.
export function zoneMinWidth(input: Omit<FitInput, 'room' | 'pressed'>): number {
  const { order, widths, controls, more, compact } = input;
  const buttons = controls.reduce((s, c) => s + c, 0);
  const all =
    order.reduce((s, k) => s + (widths.get(k) ?? 0), 0) +
    buttons +
    ZONE_GAP_PX * Math.max(0, order.length + controls.length - 1);
  if (order.length === 0) return all;
  const pin = order.includes(PINNED_WIDGET);
  const items = (pin ? 1 : 0) + 1 + controls.length;
  const step = (pin ? compact : 0) + more + MORE_DOT_PX + buttons + ZONE_GAP_PX * (items - 1);
  return Math.min(all, step);
}

// Whether `prev`'s row (how the Filter sits, how many widgets after it) still fits `input`, with the widths as they are
// now, More naming a press it holds or, short of room for the name, marking it with a dot; the arrangement it would
// keep, or null when it overflows. A refit in the same room with
// the same widgets keeps it (useZoneFit, board-widgets.md "A press never reshuffles the row"), so a press, a typed
// filter or a count changing moves a widget only when the row would otherwise overflow. Linear in the widgets.
export function keptFit(input: FitInput, prev: ZoneFit): ZoneFit | null {
  const { order, widths, room, controls, more, compact, pressed } = input;
  const width = (k: BoardWidgetId) => widths.get(k) ?? 0;
  const buttons = controls.reduce((s, c) => s + c, 0);
  const all =
    order.reduce((s, k) => s + width(k), 0) +
    buttons +
    ZONE_GAP_PX * Math.max(0, order.length + controls.length - 1);
  if (!prev.overflow) return all <= room + 0.5 ? { ...prev, need: all } : null;
  const pin = prev.pinned && order.includes(PINNED_WIDGET);
  const rest = pin ? order.filter((k) => k !== PINNED_WIDGET) : order;
  if (prev.shown >= rest.length) return null;
  const pinWidth = pin ? (prev.filter === 'compact' ? compact : width(PINNED_WIDGET)) : 0;
  let row = 0;
  for (let i = 0; i < prev.shown; i++) row += width(rest[i]!);
  let held = false;
  for (let i = prev.shown; i < rest.length && !held; i++) held = pressed.has(rest[i]!);
  const items = (pin ? 1 : 0) + prev.shown + 1 + controls.length;
  const used = pinWidth + row + more + buttons + ZONE_GAP_PX * (items - 1);
  // More names a press it holds where that fits, else marks it with a dot, the row as it was either way.
  for (const named of prev.named ? [true, false] : [false]) {
    const mark = held ? (named ? MORE_LABEL_MAX_PX : MORE_DOT_PX) : 0;
    if (used + mark <= room + 0.5) return { ...prev, named: held ? named : prev.named, need: all };
  }
  return null;
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

const NONE_PRESSED: ReadonlySet<BoardWidgetId> = new Set();

const sameFit = (a: ZoneFit, b: ZoneFit) =>
  a.overflow === b.overflow &&
  a.pinned === b.pinned &&
  a.filter === b.filter &&
  a.named === b.named &&
  a.shown === b.shown &&
  Math.abs(a.need - b.need) < 0.5;

// Measures the zone: the room it has, each widget's width wherever it is drawn (the row, the pinned Filter, the
// measuring layer), the buttons and the ghost More, with one ResizeObserver that is re-pointed when the row changes.
// Each callback works the fit out again and sets state only when it changes. The presses come in from the caller
// (read after every render), so a press that moves a widget's need for a label refits too. Room 0 (the zone not laid
// out: a hidden tab, jsdom) keeps the last fit. `pressed` is null until the caller has read the presses once: a fit
// made before then is never kept, so a board that mounts with a press lays out as if fitted afresh.
export function useZoneFit(
  zone: RefObject<HTMLElement | null>,
  widgets: readonly BoardWidgetId[],
  pressedOrUnread: ReadonlySet<BoardWidgetId> | null,
): ZoneFit {
  const read = pressedOrUnread !== null;
  const pressed = pressedOrUnread ?? NONE_PRESSED;
  const [fit, setFit] = useState<ZoneFit>(FITS_ALL);
  const now = useRef(fit);
  // The room and widgets the last fit was worked out for: a refit with both the same keeps its row (keptFit).
  const basis = useRef<{ room: number; key: string } | null>(null);
  const pressedRef = useRef(pressed);
  pressedRef.current = pressed;
  const measureRef = useRef<() => void>(() => {});
  const key = widgets.join();
  const pressedKey = `${read ? 'read' : 'unread'}:${[...pressed].join()}`;
  const readRef = useRef(read);
  readRef.current = read;
  useLayoutEffect(() => {
    const z = zone.current;
    if (!z) return;
    const measure = () => {
      const room = z.clientWidth;
      if (room <= 0) return;
      const widths = new Map<BoardWidgetId, number>();
      // Each widget's own width: the compact Filter is not the Filter's (the measuring layer holds its whole).
      for (const el of z.querySelectorAll<HTMLElement>(
        '[data-widget]:not([data-widget-compact])',
      )) {
        const kind = el.dataset['widget'] as BoardWidgetId;
        if (!widths.has(kind)) widths.set(kind, el.offsetWidth);
      }
      const controls = [...z.querySelectorAll<HTMLElement>('[data-widget-control]')].map(
        (el) => el.offsetWidth,
      );
      const more = z.querySelector<HTMLElement>('[data-widget-more-ghost]')?.offsetWidth ?? 0;
      const compact = z.querySelector<HTMLElement>('[data-widget-compact-ghost]')?.offsetWidth ?? 0;
      const input: FitInput = {
        order: widgets,
        widths,
        room,
        controls,
        more,
        compact,
        pressed: pressedRef.current,
      };
      // What the header's chips may not take from the zone (use-chips-fit.ts): a DOM write, no state.
      z.dataset['widgetZoneMin'] = String(Math.ceil(zoneMinWidth(input)));
      const was = basis.current;
      const same = was !== null && was.key === key && Math.abs(was.room - room) < 0.5;
      const next = (same ? keptFit(input, now.current) : null) ?? fitWidgets(input);
      basis.current = readRef.current ? { room, key } : null;
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
      '[data-widget], [data-widget-control], [data-widget-more-ghost], [data-widget-compact-ghost]',
    ))
      seen.observe(el);
    return () => seen.disconnect();
    // Re-pointed as the widgets, the fit (which moves them between the row and the measuring layer) or the presses
    // change.
    // oxlint-disable-next-line react/exhaustive-deps -- `key` stands for `widgets`
  }, [zone, key, fit, pressedKey]);
  return fit;
}
