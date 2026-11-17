'use client';

// A board header's widget zone (docs/specs/026-plan/board-widgets.md "Placing and arranging widgets"):
// the board's widgets in order, one row that never scrolls: the widgets that do not fit go into More at its end
// (ZoneMore), the Filter then holding the zone's start (zone-overflow.ts, Work Tracker 880). Someone who may edit drags a
// widget left or right to reorder it (a bar shows where it lands), moves a focused one with Alt+← and
// Alt+→, and takes one off with its × (shown on every widget while the zone is in edit mode, which Edit Widgets after
// the + turns on) or Delete. The + at the zone's end opens the widget gallery (BoardWidgetPicker): a widget pressed
// there is added at the end, or taken off when the board has it, and the gallery stays open. For You is worked out
// as it opens (`suggest`).
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  placeWidget,
  removeWidget,
  toggleWidget,
  type BoardField,
  type BoardWidgetId,
} from '@liveplanner/items';
import type { WidgetSuggestion } from '@liveplanner/plan-art';
import { CheckIcon, CloseIcon, PlusIcon, Tooltip, lucideGlyph } from '@liveplanner/ui';
import { glyphStrokePx } from '@liveworkspace/icons';
import { lucidePencil } from '@liveworkspace/icons/lucide';
import type { PlanPalette } from '../plan-palette';
import { InfoArt } from '../plan-tile-art';
import { widgetSlotAt } from '@/hooks/plan/widget-slot';
import { BoardWidgetPicker } from './BoardWidgetPicker';
import { HEADER_ARRIVAL_CLASS, headerArrivalIndex, headerArrivalRow } from '../header-arrival';
import {
  PINNED_WIDGET,
  moreLabel,
  nudgeInRow,
  pressedIn,
  slotInList,
  useZoneFit,
  zoneLayout,
} from './zone-overflow';
import { ZoneMore, ZoneMoreGhost, morePanelWidth } from './ZoneMore';

const PencilIcon = lucideGlyph(lucidePencil, 14);

// The + is drawn 14px on a 24-unit grid, so its ink spans 14 / 24 of that. The pencil's drawing fills 19 of 24 units
// and the check 16, so at the same box they read larger than the +. Sized by their ink instead (about 9px across,
// that of the +) and kept at the + stroke weight, the three read as one size.
const PLUS_SIZE = 14;
const PENCIL_SIZE = 10;
const CHECK_SIZE = 12;
const ZONE_GLYPH_WEIGHT = glyphStrokePx(PLUS_SIZE);

// Pixels a press travels before it is a reorder rather than a click.
const REORDER_THRESHOLD_PX = 4;

type Reorder = { kind: BoardWidgetId; startX: number; dx: number; slot: number; moved: boolean };

// The zone's small square buttons (the + and Edit Widgets): one container so they match in size, dashed border, hover
// and dark mode. Pressed (Edit Widgets while editing) fills it with the focus colour and solidifies the border.
function ZoneButton({
  size,
  palette,
  pressed = false,
  enter,
  children,
  ...rest
}: {
  size: 'sm' | 'md';
  palette: PlanPalette;
  pressed?: boolean;
  // Its place in the header's fan-in after the widgets (header-arrival.ts); none, it does not fan in.
  enter?: number;
  children: ReactNode;
} & Omit<React.ComponentProps<'button'>, 'type' | 'className' | 'style' | 'onPointerDown'>) {
  return (
    <button
      type="button"
      data-widget-control=""
      {...rest}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-md border transition hover:bg-black/5 dark:hover:bg-white/10 ${
        pressed ? '' : 'border-dashed'
      } ${size === 'sm' ? 'ml-1 h-6 w-6' : 'h-7 w-7'} ${enter === undefined ? '' : HEADER_ARRIVAL_CLASS}`}
      style={{
        ...(pressed
          ? {
              borderColor: palette.focus,
              color: palette.focus,
              backgroundColor: `color-mix(in srgb, ${palette.focus} 14%, transparent)`,
            }
          : { borderColor: palette.border, color: palette.muted }),
        ...(enter === undefined ? {} : headerArrivalIndex(enter)),
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {children}
    </button>
  );
}

export function BoardWidgetZone({
  widgets,
  canEdit,
  selected = false,
  offerAdd = false,
  palette,
  onChange,
  render,
  labelOf,
  fields,
  suggest,
}: {
  widgets: readonly BoardWidgetId[];
  canEdit: boolean;
  // The board is selected: only then does an empty zone show its hint.
  selected?: boolean;
  // An empty zone shows its + to someone who may edit even while the board is not selected (in a header band, where
  // the board is maximised or fills its tab and no selection shows), the hint still waiting for a selection.
  offerAdd?: boolean;
  palette: PlanPalette;
  onChange: (next: BoardWidgetId[]) => void;
  // `compact`: the Filter as one button, for a zone too narrow for it whole (zone-overflow.ts).
  render: (kind: BoardWidgetId, opts?: { compact?: boolean }) => ReactNode;
  // A widget's name ("Completion", "Budget Sum"): its wrapper's and its ×'s accessible names.
  labelOf: (kind: BoardWidgetId) => string;
  // The gallery's field widgets, and its For You, worked out only as it opens.
  fields?: readonly BoardField[] | undefined;
  suggest?: (() => WidgetSuggestion[]) | undefined;
}) {
  const zone = useRef<HTMLDivElement>(null);
  // The row's list of widgets (a drag's landmarks).
  const list = useRef<HTMLDivElement>(null);
  // Which widgets hold a press, read from the zone after every render (the row's and the measuring layer's copies), so
  // More names the one it holds; kept by its key, so an unchanged read sets nothing.
  // Null until the first read (useZoneFit keeps no fit made before it).
  const [pressed, setPressed] = useState<{
    key: string | null;
    map: Map<BoardWidgetId, string[]>;
  }>({
    key: null,
    map: new Map(),
  });
  // After every render on purpose: a press is drawn by the widget the caller renders, so no prop says it changed. The
  // updater returns the same state for the same read, so React bails out and nothing chains.
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- read after every render, settles on the same key
  useLayoutEffect(() => {
    const map = pressedIn(zone.current);
    const key = JSON.stringify([...map]);
    setPressed((was) => (was.key === key ? was : { key, map }));
  });
  const pressedKinds = useMemo(
    () => (pressed.key === null ? null : new Set(pressed.map.keys())),
    [pressed],
  );
  const fit = useZoneFit(zone, widgets, pressedKinds);
  const layout = zoneLayout(widgets, fit);
  const pinned = layout.pin;
  // The widgets the row holds, after the pinned Filter while it pins. A drag's slot and a nudge are in its order.
  const rowWidgets = layout.row;
  const hidden = layout.hidden;
  // The More Widgets panel, hung from More while it is open; gone with the last widget More held.
  const [moreAt, setMoreAt] = useState<HTMLElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(0);
  if (moreAt && layout.hidden.length === 0) setMoreAt(null);
  const [reorder, setReorder] = useState<Reorder | null>(null);
  // Edit mode: every widget shows its ×. This person's alone, never saved; it ends on Done, Escape, a press outside the
  // zone, or the last widget going.
  const [editing, setEditing] = useState(false);
  const active = editing && canEdit && widgets.length > 0;
  // Listening only while editing, in the capture phase so a press that stops its own propagation still counts.
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      // The More Widgets panel is the zone's too, portalled out of it.
      if (zone.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-widget-more-panel]')) return;
      setEditing(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(false);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [active]);
  // The last widget went by this person's hand: the empty zone shows its + to them, where the focus goes next.
  // Until widgets come back: then a later emptying (a peer's) leaves an unselected board clean again.
  const [emptied, setEmptied] = useState(false);
  const [seen, setSeen] = useState(widgets);
  if (seen !== widgets) {
    setSeen(widgets);
    if (emptied && widgets.length > 0) setEmptied(false);
  }
  // Takes a widget off. Edit mode stays on for the next, unless that was the last. The focus moves on to the same
  // control of the widget that takes its place once the new list lands (board-widgets.md "Remove").
  const remove = (kind: BoardWidgetId, control: 'remove' | 'widget') => {
    if (widgets.length === 1) {
      setEditing(false);
      setEmptied(true);
    }
    refocus.current = { kind, at: widgets.indexOf(kind), control };
    (document.activeElement as HTMLElement | null)?.blur();
    onChange(removeWidget(widgets, kind));
  };
  // Where the focus goes once `widgets` changes. A move (Alt+← or Alt+→): React moves the widget's node (or the board
  // redraws it), which drops the focus, so it is put back on the widget (board-widgets.md "Reorder"). A removal: the
  // same control on the widget now at its place, or the one before at the end; with none left, the zone's +.
  const refocus = useRef<
    | { kind: BoardWidgetId; moved: true }
    | { kind: BoardWidgetId; at: number; control: 'remove' | 'widget' }
    | null
  >(null);
  useLayoutEffect(() => {
    const pending = refocus.current;
    if (!pending) return;
    const removed = !('moved' in pending);
    // Another change landed first (a peer's): wait for this person's own.
    if (removed && widgets.includes(pending.kind)) return;
    refocus.current = null;
    // The widgets as drawn: the row's and the More Widgets panel's, never the measuring layer's copies.
    const wrappers = [
      ...(zone.current?.querySelectorAll<HTMLElement>('[data-widget]:not([data-widget-ghost])') ??
        []),
      ...document.querySelectorAll<HTMLElement>('[data-widget-more-panel] [data-widget]'),
    ];
    const wrapperOf = (kind: BoardWidgetId) => wrappers.find((w) => w.dataset.widget === kind);
    let el: HTMLElement | null | undefined;
    if (!removed) el = wrapperOf(pending.kind);
    else if (widgets.length === 0)
      el = zone.current?.querySelector<HTMLElement>('button[aria-label="Add a widget"]');
    else {
      // The widget now at its place in the board's list, wherever it is drawn (the pinned Filter too).
      const next = wrapperOf(widgets[Math.min(pending.at, widgets.length - 1)]!);
      if (!next) return;
      el =
        pending.control === 'remove'
          ? (next.querySelector<HTMLElement>('button[aria-label^="Remove "]') ?? next)
          : next;
    }
    if (el && document.activeElement !== el) el.focus();
  }, [widgets]);
  const suppressClick = useRef(false);
  // The + the widget picker hangs from, while it is open.
  const [pickerAt, setPickerAt] = useState<HTMLElement | null>(null);
  const [suggestions, setSuggestions] = useState<WidgetSuggestion[]>([]);
  const picker = pickerAt ? (
    <BoardWidgetPicker
      anchor={pickerAt}
      widgets={widgets}
      fields={fields}
      suggestions={suggestions}
      onToggle={(kind) => onChange(toggleWidget(widgets, kind))}
      onClose={() => setPickerAt(null)}
      render={render}
      palette={palette}
    />
  ) : null;
  const addButton = (size: 'sm' | 'md', enter?: number) => (
    <ZoneButton
      size={size}
      palette={palette}
      enter={enter}
      aria-label="Add a widget"
      aria-haspopup="dialog"
      aria-expanded={pickerAt !== null}
      onClick={(e) => {
        if (pickerAt) return setPickerAt(null);
        setSuggestions(suggest?.() ?? []);
        setPickerAt(e.currentTarget);
      }}
    >
      <PlusIcon size={size === 'sm' ? 12 : PLUS_SIZE} />
    </ZoneButton>
  );

  const onPointerDown = (kind: BoardWidgetId) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!canEdit || e.button !== 0) return;
    // Typing in the Filter box is not a drag.
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    setReorder({ kind, startX: e.clientX, dx: 0, slot: rowWidgets.indexOf(kind), moved: false });
    // No pointer capture yet: a press that stays put is a click on the widget's own control, and
    // capturing here would hand that click to this wrapper instead.
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!reorder || !list.current) return;
    const dx = e.clientX - reorder.startX;
    const moved = reorder.moved || Math.abs(dx) > REORDER_THRESHOLD_PX;
    if (!moved) return;
    // Past the threshold it is a drag: follow the pointer even off the widget.
    if (!reorder.moved) e.currentTarget.setPointerCapture(e.pointerId);
    setReorder({
      ...reorder,
      dx,
      moved,
      slot: widgetSlotAt(list.current, e.clientX, reorder.kind),
    });
  };
  const onPointerUp = () => {
    if (!reorder) return;
    if (reorder.moved) {
      suppressClick.current = true;
      const next = placeWidget(widgets, reorder.kind, slotInList(widgets, layout, reorder.slot));
      if (next.join() !== widgets.join()) onChange(next);
    }
    setReorder(null);
  };

  const bar = (key: string) => (
    <span
      key={key}
      aria-hidden
      className="h-6 w-0.5 shrink-0 rounded-full"
      style={{ backgroundColor: palette.focus }}
    />
  );
  const barAt = reorder?.moved ? reorder.slot : null;

  if (widgets.length === 0) {
    return (
      <div
        ref={zone}
        data-widget-zone
        className="flex h-9 min-w-0 flex-1 items-center rounded-md px-2 text-[12px]"
        style={{ color: palette.muted }}
      >
        {canEdit && selected ? (
          // The hint only while the board is selected, so an unselected header stays clean.
          <span className="inline-flex items-center gap-1.5">
            <InfoArt />
            Add widgets to this board
            {addButton('sm')}
          </span>
        ) : canEdit && (offerAdd || emptied) ? (
          addButton('md', 0)
        ) : null}
        {picker}
      </div>
    );
  }

  // One widget: in the row, a list item that drags to reorder; pinned at the zone's start (the Filter while some are in
  // More), a group that stays put, its Delete and its × still taking it off; in the More Widgets panel, a list item that
  // moves with Alt+arrows but does not drag.
  const item = (kind: BoardWidgetId, i: number, place: 'row' | 'pin' | 'more' = 'row') => {
    const atStart = place === 'pin';
    const drags = place === 'row';
    const dragged = drags && reorder?.moved && reorder.kind === kind;
    // The pinned Filter as one button while the room cannot hold it whole.
    const compact = atStart && fit.filter === 'compact';
    return (
      <div
        key={kind}
        data-widget={kind}
        data-widget-compact={compact ? '' : undefined}
        data-widget-in-more={place === 'more' ? '' : undefined}
        role={atStart ? 'group' : 'listitem'}
        tabIndex={canEdit ? 0 : undefined}
        aria-label={canEdit || atStart ? `${labelOf(kind)} widget` : undefined}
        aria-keyshortcuts={
          canEdit ? (atStart ? 'Delete' : 'Alt+ArrowLeft Alt+ArrowRight Delete') : undefined
        }
        className={`relative flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 ${
          canEdit && drags ? 'cursor-grab active:cursor-grabbing' : ''
        } ${place === 'more' ? '' : HEADER_ARRIVAL_CLASS}`}
        style={{
          transform: dragged ? `translateX(${reorder.dx}px)` : undefined,
          zIndex: dragged ? 2 : undefined,
          opacity: dragged ? 0.85 : 1,
          ['--tw-ring-color' as string]: palette.focus,
          ...headerArrivalIndex(i),
        }}
        onPointerDown={drags ? onPointerDown(kind) : (e) => e.stopPropagation()}
        onPointerMove={drags ? onPointerMove : undefined}
        onPointerUp={drags ? onPointerUp : undefined}
        onPointerCancel={drags ? () => setReorder(null) : undefined}
        onClickCapture={(e) => {
          if (!suppressClick.current) return;
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (!canEdit || e.target !== e.currentTarget) return;
          if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
            if (atStart) return;
            e.preventDefault();
            e.stopPropagation();
            const next = nudgeInRow(widgets, kind, e.key === 'ArrowLeft' ? -1 : 1, pinned);
            if (next.join() === widgets.join()) return;
            refocus.current = { kind, moved: true };
            onChange(next);
          } else if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            e.stopPropagation();
            remove(kind, 'widget');
          }
        }}
      >
        {compact ? render(kind, { compact: true }) : render(kind)}
        {active ? (
          <button
            type="button"
            aria-label={`Remove ${labelOf(kind)}`}
            className="absolute -right-1 -top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border shadow-sm"
            style={{
              backgroundColor: palette.card,
              borderColor: palette.border,
              color: palette.muted,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              remove(kind, 'remove');
            }}
          >
            <CloseIcon size={9} />
          </button>
        ) : null}
      </div>
    );
  };

  const label = moreLabel(hidden, pressed.map);
  return (
    <div
      ref={zone}
      data-widget-zone
      data-widget-zone-pinned={pinned ? '' : undefined}
      // Packed to the end while some widgets are in More, so the + and Edit Widgets keep their place at the header's
      // edge however many widgets the row holds (a press can move one into More), the slack going before the Filter.
      className={`relative flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-md ${
        hidden.length > 0 ? 'justify-end' : ''
      }`}
      // The widgets, then the + and Edit Widgets, fan in as the header mounts (header-arrival.ts). It asks for every
      // widget's width, so in a header band (sized by its content, up to its cap) it is given the room it could have.
      style={{ ...headerArrivalRow, width: fit.need > 0 ? fit.need : undefined }}
    >
      {pinned ? (
        <div data-widget-pin className="flex shrink-0 items-center">
          {item(PINNED_WIDGET, widgets.indexOf(PINNED_WIDGET), 'pin')}
        </div>
      ) : null}
      {/* The widgets are the list; More, the + and Edit Widgets follow it rather than sitting in it, since a list
          holds only its items. Empty, it takes no room. */}
      <div
        ref={list}
        data-widget-row
        role="list"
        aria-label="Board widgets"
        className="flex shrink-0 items-center gap-1.5 empty:hidden"
      >
        {rowWidgets.map((kind, i) => {
          const dragged = reorder?.moved && reorder.kind === kind;
          return [
            barAt === i && !dragged ? bar(`bar-${i}`) : null,
            item(kind, widgets.indexOf(kind)),
          ];
        })}
        {barAt === rowWidgets.length ? bar('bar-end') : null}
      </div>
      {hidden.length > 0 ? (
        <ZoneMore
          count={hidden.length}
          label={label}
          named={fit.named}
          palette={palette}
          open={moreAt}
          panelWidth={panelWidth}
          onToggle={(button) => {
            if (moreAt) return setMoreAt(null);
            // As wide as the widest widget it holds, read from the measuring layer as it opens.
            const widths = [
              ...(zone.current?.querySelectorAll<HTMLElement>(
                '[data-widget-ghost]:not([data-widget-measure-only])',
              ) ?? []),
            ].map((el) => el.offsetWidth);
            setPanelWidth(morePanelWidth(Math.max(0, ...widths)));
            setMoreAt(button);
          }}
          onClose={() => setMoreAt(null)}
        >
          {hidden.map((kind) => item(kind, widgets.indexOf(kind), 'more'))}
        </ZoneMore>
      ) : null}
      {canEdit ? addButton('md', widgets.length) : null}
      {canEdit ? (
        <Tooltip label={active ? 'Done Editing Widgets' : 'Edit Widgets'}>
          <ZoneButton
            size="md"
            palette={palette}
            pressed={active}
            enter={widgets.length + 1}
            aria-label={active ? 'Done Editing Widgets' : 'Edit Widgets'}
            aria-pressed={active}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(!active);
            }}
          >
            {active ? (
              <CheckIcon size={CHECK_SIZE} weight={ZONE_GLYPH_WEIGHT} />
            ) : (
              <PencilIcon size={PENCIL_SIZE} weight={ZONE_GLYPH_WEIGHT} />
            )}
          </ZoneButton>
        </Tooltip>
      ) : null}
      {/* The measuring layer: the widgets in More, drawn unseen at their own width (and a ghost More), so the fit
          knows every widget's width and which hold a press, wherever they are drawn. Never read or reached. */}
      <div
        data-widget-measure
        aria-hidden
        inert
        className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden"
      >
        <div className="flex w-max items-center gap-1.5">
          {hidden.map((kind) => (
            <div
              key={kind}
              data-widget={kind}
              data-widget-ghost=""
              className="relative flex shrink-0 items-center rounded-md"
            >
              {render(kind)}
            </div>
          ))}
          {/* The Filter whole while it pins compact, so its width (and press) stay known; and compact, for its width. */}
          {fit.filter === 'compact' && widgets.includes(PINNED_WIDGET) ? (
            <div
              data-widget={PINNED_WIDGET}
              data-widget-ghost=""
              data-widget-measure-only=""
              className="relative flex shrink-0 items-center rounded-md"
            >
              {render(PINNED_WIDGET)}
            </div>
          ) : null}
          {/* The compact Filter's width: whether it goes compact, and the zone's narrowest (zoneMinWidth). */}
          {widgets.includes(PINNED_WIDGET) ? (
            <div data-widget-compact-ghost="" className="flex shrink-0 items-center">
              {render(PINNED_WIDGET, { compact: true })}
            </div>
          ) : null}
          <ZoneMoreGhost palette={palette} />
        </div>
      </div>
      {picker}
    </div>
  );
}
