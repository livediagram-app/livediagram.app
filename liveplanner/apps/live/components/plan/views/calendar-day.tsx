'use client';

// A calendar's day and its entries (docs/specs/026-plan/plan-views.md "Due Calendar"): the date, then the cards
// placed that day as minimal cards where there is room, else a type dot and title each, as many as fit and then
// "+N more". Pressing an entry opens its card; someone who may move cards drags it to another day, or moves it
// with Alt+Arrows while it has focus (CalendarView's moveBy).
import { memo } from 'react';
import { CARD_FIELDS, itemTitle, type CalendarDay, type Item } from '@liveplanner/items';
import type { PlanPalette } from '../plan-palette';
import { useGhostPoint, type CalendarGhostPosition } from './useCalendarDrag';
import { PlanCardFace } from '../PlanCardFace';
import { openProps } from './view-frame';
import type { PlanViewProps } from './PlanViewView';

// A day's entry height, and the room its date takes.
export const ENTRY_H = 16;
export const DATE_H = 18;
// A day's room for a card drawn at Minimal size (a board's face: its title, up to two lines, between its type dot
// and fields), and the gap under it: a day tall enough for one shows cards so. A two-line Minimal card measures
// 58 px in a 193 px day, so two of them still fit a maximised month's 139 px day.
export const CARD_H = 50;
export const CARD_GAP = 4;

// The keys that move a focused entry, and by how many days (with Alt held).
const CALENDAR_MOVE_KEYS: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

export type CalendarEntryActions = {
  // The drag's press (useCalendarDrag's begin), when the person may move cards.
  begin?: (itemId: string, fromDay: number) => (e: React.PointerEvent<HTMLElement>) => void;
  // Alt+Arrows: move the card by `days`.
  moveBy?: (item: Item, fromDay: number, days: number) => void;
  // The card being dragged, drawn faded in its place.
  draggingId?: string;
};

// Memoised: a drag re-renders only the days whose props change (the day left and the day entered), never all 42 on
// every pointer move (CalendarView hands it stable actions and colours).
export const DayCell = memo(function DayCell({
  cell,
  isToday,
  isTarget,
  palette,
  colourOf,
  plan,
  room,
  asCards,
  actions,
}: {
  cell: CalendarDay;
  isToday: boolean;
  // The day a dragged card would land on.
  isTarget: boolean;
  palette: PlanPalette;
  colourOf: (type: string) => string;
  plan: PlanViewProps['plan'];
  room: number;
  asCards: boolean;
  actions: CalendarEntryActions;
}) {
  // As many as fit, the last line kept for "+N more" when some do not.
  const shown = cell.cards.length > room ? cell.cards.slice(0, Math.max(0, room - 1)) : cell.cards;
  const more = cell.cards.length - shown.length;
  return (
    <div
      data-calendar-day={cell.day}
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-r px-1 pb-0.5"
      style={{
        borderColor: palette.border,
        backgroundColor: cell.inMonth ? undefined : palette.column,
        opacity: cell.inMonth || isTarget ? 1 : 0.7,
        ...(isTarget ? { boxShadow: `inset 0 0 0 2px ${palette.focus}` } : null),
      }}
    >
      <span className="flex shrink-0 items-center" style={{ height: DATE_H }}>
        <span
          className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 text-[10px] font-semibold tabular-nums"
          style={
            isToday
              ? { boxShadow: `0 0 0 1.5px ${palette.focus}`, color: palette.focus }
              : { color: palette.muted }
          }
        >
          <span className="text-optical-centre">{cell.date}</span>
        </span>
      </span>
      <div className={`flex min-h-0 flex-col overflow-hidden ${asCards ? 'gap-1' : ''}`}>
        {shown.map(({ item, done }) => (
          <CalendarEntry
            key={item.id}
            item={item}
            done={done}
            day={cell.day}
            asCards={asCards}
            palette={palette}
            colour={colourOf(item.type)}
            plan={plan}
            actions={actions}
          />
        ))}
        {more > 0 ? (
          <span className="shrink-0 px-0.5 text-[10px]" style={{ color: palette.muted }}>
            +{more} more
          </span>
        ) : null}
      </div>
    </div>
  );
});

// The lifted copy a drag carries: the entry as drawn, following the pointer on its own (useGhostPoint), so a move
// re-renders it alone; tilted only where motion is welcome.
export function CalendarGhost({
  ghost,
  item,
  width,
  asCards,
  palette,
  colour,
}: {
  ghost: CalendarGhostPosition;
  item: Item;
  width: number;
  asCards: boolean;
  palette: PlanPalette;
  colour: string;
}) {
  const at = useGhostPoint(ghost);
  return (
    <div
      aria-hidden
      data-calendar-ghost=""
      className={`pointer-events-none absolute left-0 top-0 z-20 rounded-lg shadow-lg motion-safe:-rotate-2 motion-safe:scale-[1.03] ${entryClass(asCards, false)}`}
      style={{
        width,
        translate: `${at.x}px ${at.y}px`,
        ...(asCards
          ? null
          : { height: ENTRY_H, color: palette.text, backgroundColor: palette.surface }),
      }}
    >
      <CalendarEntryFace
        item={item}
        done={false}
        asCards={asCards}
        palette={palette}
        colour={colour}
      />
    </div>
  );
}

// What an entry shows: a minimal card face, or a type dot and title. Shared by the lifted copy a drag carries.
export function CalendarEntryFace({
  item,
  done,
  asCards,
  palette,
  colour,
}: {
  item: Item;
  done: boolean;
  asCards: boolean;
  palette: PlanPalette;
  colour: string;
}) {
  if (asCards)
    return <PlanCardFace item={item} palette={palette} fields={CARD_FIELDS} size="minimal" />;
  return (
    <>
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: colour }}
      />
      <span className={`min-w-0 truncate ${done ? 'line-through' : ''}`}>{itemTitle(item)}</span>
    </>
  );
}

const entryClass = (asCards: boolean, done: boolean) =>
  asCards
    ? `block w-full min-w-0 shrink-0 cursor-pointer rounded-lg text-left ${done ? 'opacity-60' : ''}`
    : 'flex w-full min-w-0 shrink-0 cursor-pointer items-center gap-1 rounded px-0.5 text-left text-[10px] transition hover:bg-black/5 dark:hover:bg-white/10';

function CalendarEntry({
  item,
  done,
  day,
  asCards,
  palette,
  colour,
  plan,
  actions,
}: {
  item: Item;
  done: boolean;
  day: number;
  asCards: boolean;
  palette: PlanPalette;
  colour: string;
  plan: PlanViewProps['plan'];
  actions: CalendarEntryActions;
}) {
  const open = openProps(plan, item.id);
  const { begin, moveBy } = actions;
  const movable = !!begin;
  return (
    <button
      type="button"
      data-calendar-item={item.id}
      className={`${entryClass(asCards, done)} ${movable ? 'touch-none select-none' : ''} ${
        actions.draggingId === item.id ? 'opacity-40' : ''
      }`}
      style={asCards ? undefined : { height: ENTRY_H, color: done ? palette.muted : palette.text }}
      aria-label={`#${item.key} ${itemTitle(item)}${done ? ', done' : ''}`}
      {...(movable
        ? {
            'aria-keyshortcuts': 'Alt+ArrowLeft Alt+ArrowRight Alt+ArrowUp Alt+ArrowDown',
            'aria-roledescription': 'movable card',
          }
        : null)}
      {...open}
      onPointerDown={(e) => {
        open.onPointerDown?.(e);
        begin?.(item.id, day)(e);
      }}
      onKeyDown={(e) => {
        const days = CALENDAR_MOVE_KEYS[e.key];
        if (!moveBy || !e.altKey || days === undefined) return;
        e.preventDefault();
        e.stopPropagation();
        moveBy(item, day, days);
      }}
    >
      <CalendarEntryFace
        item={item}
        done={done}
        asCards={asCards}
        palette={palette}
        colour={colour}
      />
    </button>
  );
}
