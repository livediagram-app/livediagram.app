'use client';

// A board header's widget zone (docs/specs/025-plan/board-widgets.md "Placing and arranging widgets"):
// the board's widgets in order, one row that scrolls sideways when full. Someone who may edit drags a
// widget left or right to reorder it (a bar shows where it lands), moves a focused one with Alt+← and
// Alt+→, and takes one off with its × or Delete. A widget dragged in from the palette shows the same
// bar (`dropAt`, from the palette drag); the drop itself is the palette's.
import { useRef, useState, type ReactNode } from 'react';
import { placeWidget, removeWidget, nudgeWidget, type BoardWidgetKind } from '@livediagram/items';
import { CloseIcon } from '@livediagram/ui';
import type { PlanPalette } from '../plan-palette';
import { BOARD_WIDGET_INFO } from '../board-widget-catalogue';
import { InfoArt } from '../plan-tile-art';
import { widgetSlotAt } from '@/hooks/plan/plan-widget-drop';

// Pixels a press travels before it is a reorder rather than a click.
const REORDER_THRESHOLD_PX = 4;

type Reorder = { kind: BoardWidgetKind; startX: number; dx: number; slot: number; moved: boolean };

export function BoardWidgetZone({
  widgets,
  canEdit,
  palette,
  dropAt,
  flash = null,
  onChange,
  render,
}: {
  widgets: readonly BoardWidgetKind[];
  canEdit: boolean;
  palette: PlanPalette;
  // Where a widget dragged from the palette would land, while one is over this zone.
  dropAt: number | null;
  flash?: BoardWidgetKind | null;
  onChange: (next: BoardWidgetKind[]) => void;
  render: (kind: BoardWidgetKind) => ReactNode;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [reorder, setReorder] = useState<Reorder | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (kind: BoardWidgetKind) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
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
  const barAt = reorder?.moved ? reorder.slot : dropAt;

  if (widgets.length === 0) {
    return (
      <div
        ref={zone}
        data-widget-zone
        className="flex h-9 min-w-0 flex-1 items-center rounded-md px-2 text-[12px]"
        style={{
          color: palette.muted,
          outline: dropAt !== null ? `1.5px dashed ${palette.focus}` : undefined,
        }}
      >
        {dropAt !== null ? (
          bar('drop')
        ) : canEdit ? (
          <span className="inline-flex items-center gap-1.5">
            <InfoArt />
            Drag Widgets here from the palette
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={zone}
      data-widget-zone
      role="list"
      aria-label="Board widgets"
      className="flex h-9 min-w-0 flex-1 items-center gap-1.5 overflow-x-auto overflow-y-hidden rounded-md px-1 [scrollbar-width:thin]"
      style={{ outline: dropAt !== null ? `1.5px dashed ${palette.focus}` : undefined }}
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
              flash === kind ? 'animate-pulse motion-reduce:animate-none' : ''
            } ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
            style={{
              transform: dragged ? `translateX(${reorder!.dx}px)` : undefined,
              boxShadow: flash === kind ? `0 0 0 2px ${palette.focus}` : undefined,
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
                onChange(removeWidget(widgets, kind));
              }
            }}
          >
            {render(kind)}
            {canEdit ? (
              <button
                type="button"
                aria-label={`Remove ${BOARD_WIDGET_INFO[kind].label}`}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full border shadow-sm group-hover/widget:flex group-focus-within/widget:flex [@media(pointer:coarse)]:flex"
                style={{
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  color: palette.muted,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(removeWidget(widgets, kind));
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
  );
}
