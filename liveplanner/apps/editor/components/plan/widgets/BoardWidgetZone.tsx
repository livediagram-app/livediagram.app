'use client';

// A board header's widget zone (docs/specs/026-plan/board-widgets.md "Placing and arranging widgets"):
// the board's widgets in order, one row that scrolls sideways when full. Someone who may edit drags a
// widget left or right to reorder it (a bar shows where it lands), moves a focused one with Alt+← and
// Alt+→, and takes one off with its × (shown on every widget while the zone is in edit mode, which Edit Widgets after
// the + turns on) or Delete. The + at the zone's end opens the widget gallery (BoardWidgetPicker): a widget pressed
// there is added at the end, or taken off when the board has it, and the gallery stays open. For You is worked out
// as it opens (`suggest`).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  placeWidget,
  removeWidget,
  nudgeWidget,
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
  children,
  ...rest
}: {
  size: 'sm' | 'md';
  palette: PlanPalette;
  pressed?: boolean;
  children: ReactNode;
} & Omit<React.ComponentProps<'button'>, 'type' | 'className' | 'style' | 'onPointerDown'>) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-md border transition hover:bg-black/5 dark:hover:bg-white/10 ${
        pressed ? '' : 'border-dashed'
      } ${size === 'sm' ? 'ml-1 h-6 w-6' : 'h-7 w-7'}`}
      style={
        pressed
          ? {
              borderColor: palette.focus,
              color: palette.focus,
              backgroundColor: `color-mix(in srgb, ${palette.focus} 14%, transparent)`,
            }
          : { borderColor: palette.border, color: palette.muted }
      }
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
  render: (kind: BoardWidgetId) => ReactNode;
  // A widget's name ("Completion", "Budget Sum"): its wrapper's and its ×'s accessible names.
  labelOf: (kind: BoardWidgetId) => string;
  // The gallery's field widgets, and its For You, worked out only as it opens.
  fields?: readonly BoardField[] | undefined;
  suggest?: (() => WidgetSuggestion[]) | undefined;
}) {
  const zone = useRef<HTMLDivElement>(null);
  const [reorder, setReorder] = useState<Reorder | null>(null);
  // Edit mode: every widget shows its ×. This person's alone, never saved; it ends on Done, Escape, a press outside the
  // zone, or the last widget going.
  const [editing, setEditing] = useState(false);
  const active = editing && canEdit && widgets.length > 0;
  // Listening only while editing, in the capture phase so a press that stops its own propagation still counts.
  useEffect(() => {
    if (!active) return;
    const onDown = (e: PointerEvent) => {
      if (!zone.current?.contains(e.target as Node)) setEditing(false);
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
  // Takes a widget off, leaving no focus on it. Edit mode stays on for the next, unless that was the last.
  const remove = (kind: BoardWidgetId) => {
    if (widgets.length === 1) setEditing(false);
    (document.activeElement as HTMLElement | null)?.blur();
    onChange(removeWidget(widgets, kind));
  };
  // The widget Alt+← or Alt+→ just moved: React moves its node (or the board redraws it), which drops the focus, so it is
  // put back once the new order lands (board-widgets.md "Reorder").
  const refocus = useRef<BoardWidgetId | null>(null);
  useLayoutEffect(() => {
    const kind = refocus.current;
    if (!kind) return;
    refocus.current = null;
    const el = [...(zone.current?.querySelectorAll<HTMLElement>('[data-widget]') ?? [])].find(
      (w) => w.dataset.widget === kind,
    );
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
  const addButton = (size: 'sm' | 'md') => (
    <ZoneButton
      size={size}
      palette={palette}
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
              aria-label={canEdit ? `${labelOf(kind)} widget` : undefined}
              aria-keyshortcuts={canEdit ? 'Alt+ArrowLeft Alt+ArrowRight Delete' : undefined}
              className={`relative flex shrink-0 items-center rounded-md outline-none focus-visible:ring-2 ${
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
                  const next = nudgeWidget(widgets, kind, e.key === 'ArrowLeft' ? -1 : 1);
                  if (next.join() === widgets.join()) return;
                  refocus.current = kind;
                  onChange(next);
                } else if (e.key === 'Delete' || e.key === 'Backspace') {
                  e.preventDefault();
                  e.stopPropagation();
                  remove(kind);
                }
              }}
            >
              {render(kind)}
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
      {canEdit ? (
        <Tooltip label={active ? 'Done Editing Widgets' : 'Edit Widgets'}>
          <ZoneButton
            size="md"
            palette={palette}
            pressed={active}
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
      {picker}
    </div>
  );
}
