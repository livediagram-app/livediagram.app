'use client';

// A board header's widget zone (docs/specs/026-plan/board-widgets.md "Placing and arranging widgets"):
// the board's widgets in order, one row that scrolls sideways when full. Someone who may edit drags a
// widget left or right to reorder it (a bar shows where it lands), moves a focused one with Alt+← and
// Alt+→, and takes one off with its × (shown only while the board is selected) or Delete. The + at the zone's end opens
// the widgets the board does not have yet (BoardWidgetPicker); one picked is added at the end.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { placeWidget, removeWidget, nudgeWidget, type BoardWidgetKind } from '@livediagram/items';
import { CloseIcon, PlusIcon } from '@livediagram/ui';
import type { PlanPalette } from '../plan-palette';
import { BOARD_WIDGET_INFO } from '@livediagram/plan-art';
import { InfoArt } from '../plan-tile-art';
import { widgetSlotAt } from '@/hooks/plan/widget-slot';
import { BoardWidgetPicker } from './BoardWidgetPicker';

// Pixels a press travels before it is a reorder rather than a click.
const REORDER_THRESHOLD_PX = 4;

type Reorder = { kind: BoardWidgetKind; startX: number; dx: number; slot: number; moved: boolean };

export function BoardWidgetZone({
  widgets,
  canEdit,
  selected = false,
  offerAdd = false,
  palette,
  onChange,
  render,
}: {
  widgets: readonly BoardWidgetKind[];
  canEdit: boolean;
  // The board is selected: only then do the widgets show their ×, and an empty zone its hint.
  selected?: boolean;
  // An empty zone shows its + to someone who may edit even while the board is not selected (in a header band, where
  // the board is maximised or fills its tab and no selection shows), the hint still waiting for a selection.
  offerAdd?: boolean;
  palette: PlanPalette;
  onChange: (next: BoardWidgetKind[]) => void;
  render: (kind: BoardWidgetKind) => ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [reorder, setReorder] = useState<Reorder | null>(null);
  // The widget a touch tapped, showing its × until another is tapped, it goes, a tap lands outside the zone or Escape
  // is pressed (no hover on a touch screen).
  const [armed, setArmed] = useState<BoardWidgetKind | null>(null);
  // A tap anywhere outside the zone, or Escape, puts the tapped widget's × away again. Listening only while one is
  // armed, in the capture phase so a press that stops its own propagation still counts.
  useEffect(() => {
    if (!armed) return;
    const onDown = (e: PointerEvent) => {
      if (!zone.current?.contains(e.target as Node)) setArmed(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArmed(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [armed]);
  // Takes a widget off, leaving nothing of it selected: no tapped widget, no focus left on it.
  const remove = (kind: BoardWidgetKind) => {
    setArmed(null);
    (document.activeElement as HTMLElement | null)?.blur();
    onChange(removeWidget(widgets, kind));
  };
  const suppressClick = useRef(false);
  // The + the widget picker hangs from, while it is open.
  const [pickerAt, setPickerAt] = useState<HTMLElement | null>(null);
  const picker = pickerAt ? (
    <BoardWidgetPicker
      anchor={pickerAt}
      widgets={widgets}
      onPick={(kind) => {
        setPickerAt(null);
        onChange(placeWidget(widgets, kind, widgets.length));
      }}
      onClose={() => setPickerAt(null)}
      render={render}
      palette={palette}
    />
  ) : null;
  const addButton = (size: 'sm' | 'md') => (
    <button
      type="button"
      aria-label="Add a widget"
      aria-haspopup="menu"
      aria-expanded={pickerAt !== null}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-md border border-dashed transition hover:bg-black/5 dark:hover:bg-white/10 ${
        size === 'sm' ? 'ml-1 h-6 w-6' : 'h-7 w-7'
      }`}
      style={{ borderColor: palette.border, color: palette.muted }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => setPickerAt(pickerAt ? null : e.currentTarget)}
    >
      <PlusIcon size={size === 'sm' ? 12 : 14} />
    </button>
  );

  const onPointerDown = (kind: BoardWidgetKind) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.pointerType === 'touch') setArmed(kind);
    if (!canEdit || e.button !== 0) return;
    // Typing in the Filter box is not a drag.
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    setReorder({ kind, startX: e.clientX, dx: 0, slot: widgets.indexOf(kind), moved: false });
    // No pointer capture yet: a press that stays put is a click on the widget's own control, and
    // capturing here would hand that click to this wrapper instead.
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!reorder || !zone.current) return;
    const dx = e.clientX - reorder.startX;
    const moved = reorder.moved || Math.abs(dx) > REORDER_THRESHOLD_PX;
    if (!moved) return;
    // Past the threshold it is a drag: follow the pointer even off the widget.
    if (!reorder.moved) e.currentTarget.setPointerCapture(e.pointerId);
    setReorder({
      ...reorder,
      dx,
      moved,
      slot: widgetSlotAt(zone.current, e.clientX, reorder.kind),
    });
  };
  const onPointerUp = () => {
    if (!reorder) return;
    if (reorder.moved) {
      suppressClick.current = true;
      const next = placeWidget(widgets, reorder.kind, reorder.slot);
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
        ) : canEdit && offerAdd ? (
          addButton('md')
        ) : null}
        {picker}
      </div>
    );
  }

  return (
    <div
      ref={zone}
      data-widget-zone
      className="flex h-9 min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden rounded-md px-1 [scrollbar-width:thin]"
    >
      {/* The widgets are the list; the Add button follows it rather than sitting in it, since a list holds only its
          items. Empty, it takes no room. */}
      <div
        role="list"
        aria-label="Board widgets"
        className="flex items-center gap-1.5 empty:hidden"
      >
        {widgets.map((kind, i) => {
          const dragged = reorder?.moved && reorder.kind === kind;
          return [
            barAt === i && !dragged ? bar(`bar-${i}`) : null,
            <div
              key={kind}
              data-widget={kind}
              role="listitem"
              tabIndex={canEdit ? 0 : undefined}
              aria-label={canEdit ? `${BOARD_WIDGET_INFO[kind].label} widget` : undefined}
              aria-keyshortcuts={canEdit ? 'Alt+ArrowLeft Alt+ArrowRight Delete' : undefined}
              className={`group/widget relative flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 ${
                canEdit ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
              style={{
                transform: dragged ? `translateX(${reorder.dx}px)` : undefined,
                zIndex: dragged ? 2 : undefined,
                opacity: dragged ? 0.85 : 1,
                ['--tw-ring-color' as string]: palette.focus,
              }}
              onPointerDown={onPointerDown(kind)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setReorder(null)}
              onClickCapture={(e) => {
                if (!suppressClick.current) return;
                suppressClick.current = false;
                e.preventDefault();
                e.stopPropagation();
              }}
              onKeyDown={(e) => {
                if (!canEdit || e.target !== e.currentTarget) return;
                if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(nudgeWidget(widgets, kind, e.key === 'ArrowLeft' ? -1 : 1));
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(kind);
                }
              }}
            >
              {render(kind)}
              {canEdit && selected ? (
                <button
                  type="button"
                  aria-label={`Remove ${BOARD_WIDGET_INFO[kind].label}`}
                  // Shown on hover or keyboard focus, or once a touch has tapped the widget; never all the time.
                  className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border shadow-sm transition-opacity duration-micro motion-reduce:transition-none ${
                    armed === kind
                      ? 'opacity-100'
                      : 'pointer-events-none opacity-0 group-focus-within/widget:pointer-events-auto group-focus-within/widget:opacity-100 group-hover/widget:pointer-events-auto group-hover/widget:opacity-100'
                  }`}
                  style={{
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                    color: palette.muted,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(kind);
                  }}
                >
                  <CloseIcon size={9} />
                </button>
              ) : null}
            </div>,
          ];
        })}
        {barAt === widgets.length ? bar('bar-end') : null}
      </div>
      {canEdit ? addButton('md') : null}
      {picker}
    </div>
  );
}
