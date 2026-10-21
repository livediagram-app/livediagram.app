'use client';

// The Due Calendar and the Start Calendar (docs/specs/026-plan/plan-views.md "Due Calendar", "Start Calendar"): a
// month in Monday weeks, each day listing the cards due (or starting) then, as many as fit and then "+N more". The
// month steps are each viewer's own. Someone who may move cards drags an entry to another day, or moves it with
// Alt+Arrows, to move its date there (calendarMove).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useToday } from '@/hooks/ui/useToday';
import {
  ITEM_TYPES,
  MONTH_LONG,
  WEEKDAY_SHORT,
  calendarFieldOf,
  calendarModel,
  calendarMove,
  dayParts,
  itemTitle,
  shiftMonth,
  todayNumber,
  typeIn,
  type CalendarField,
  type Item,
} from '@liveplanner/items';
import { ChevronLeftIcon, ChevronRightIcon } from '@liveplanner/ui';
import { track } from '@/lib/telemetry';
import { accentOn } from '../plan-palette';
import { ViewFrame, ViewStepButton, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';
import {
  CARD_GAP,
  CARD_H,
  CalendarGhost,
  DATE_H,
  DayCell,
  ENTRY_H,
  type CalendarEntryActions,
} from './calendar-day';
import { useLatest } from '@/hooks/ui/useLatest';
import { useCalendarDrag } from './useCalendarDrag';

const NO_PHASES = new Map();
// The frame's header and the weekday row above the grid.
const FRAME_HEAD_H = 40;
const WEEKDAY_H = 22;

// What each calendar calls itself and its count.
const CALENDAR_COPY: Record<
  CalendarField,
  { name: string; count: (n: number) => string; empty: string }
> = {
  due: {
    name: 'Due Calendar',
    count: (n) => `${n} due`,
    empty: 'Nothing due this month.',
  },
  start: {
    name: 'Start Calendar',
    count: (n) => `${n} starting`,
    empty: 'Nothing starts this month.',
  },
};

const dayLabel = (day: number) => {
  const p = dayParts(day);
  return `${p.date} ${MONTH_LONG[p.month]}`;
};

export function CalendarView({
  plan,
  items,
  palette,
  fontFamily,
  height,
  settings,
}: PlanViewProps) {
  const field: CalendarField = calendarFieldOf(settings.view) ?? 'due';
  const copy = CALENDAR_COPY[field];
  const phases = plan?.statusPhases ?? NO_PHASES;
  const types = plan?.types ?? ITEM_TYPES;
  // Today, as a store that moves on at midnight (useToday); never the clock read while rendering.
  const now = useToday();
  const [offset, setOffset] = useState(0);
  // This month as one number, so the model is kept until the month, the cards or the step change.
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const shown = shiftMonth(Math.floor(thisMonth / 12), thisMonth % 12, offset);
  const model = useMemo(
    () => calendarModel(items.values(), phases, shown.year, shown.month, field),
    [items, phases, shown.year, shown.month, field],
  );
  const today = todayNumber(now);
  const rows = model.weeks.length;
  const firstDay = model.weeks[0]?.[0]?.day ?? 0;
  const lastDay = model.weeks[rows - 1]?.[6]?.day ?? 0;
  // The entries a day has room for, below its date.
  const dayH = (height - FRAME_HEAD_H - WEEKDAY_H) / rows - DATE_H - 2;
  // Minimal cards, as a board draws them, where a day has room for one (a maximised calendar, a Visualisation
  // tab); a line each otherwise (a small slot).
  const cardRoom = Math.floor((dayH + CARD_GAP) / (CARD_H + CARD_GAP));
  const asCards = cardRoom >= 1;
  const room = Math.max(0, asCards ? cardRoom : Math.floor(dayH / ENTRY_H));
  // Stable while the types and colours are, so a memoised day re-renders only when its own props change.
  const colourOf = useCallback(
    (type: string) => accentOn(typeIn(types, type).color, palette),
    [types, palette],
  );

  // Moving cards: an Editor's and a Participant's, never a Viewer's, and only while the view takes input.
  const canMove = !!plan?.planInput && !!plan.canEditCards;
  const gridRef = useRef<HTMLDivElement>(null);
  // The card a keyboard move just carried, focused again where it lands (once its move shows in the model).
  const refocus = useRef<string | null>(null);
  const move = (item: Item, toDay: number): boolean => {
    const m = calendarMove(item, field, toDay);
    if (!m || !plan) return false;
    void plan.patchItem(item.id, { set: m.set });
    track('Plan', 'Changed', field === 'due' ? 'CalendarDue' : 'CalendarStart');
    const other = field === 'due' ? 'start' : 'due';
    const carried = m.set[other] ? `, its ${other === 'start' ? 'Start' : 'Due'} too` : '';
    plan.announce(`Moved #${item.key} ${itemTitle(item)} to ${dayLabel(toDay)}${carried}`);
    return true;
  };
  const { drag, begin, ghost } = useCalendarDrag({
    gridRef,
    firstDay,
    weeks: rows,
    enabled: canMove,
    onMove: (itemId, toDay) => {
      const item = items.get(itemId);
      if (item) move(item, toDay);
    },
  });
  // Alt+Arrows: the newest closure (this month, the cards), called through one stable function.
  const moveBy = useLatest((item: Item, fromDay: number, days: number) => {
    const to = fromDay + days;
    if (!move(item, to)) return;
    // Off the grid: the month follows the card.
    if (to < firstDay || to > lastDay) {
      const p = dayParts(to);
      setOffset((o) => o + (p.year * 12 + p.month) - (shown.year * 12 + shown.month));
    }
    refocus.current = item.id;
  });
  const draggingId = drag?.itemId;
  // One object while nothing it holds changes, so a pointer move inside one day re-renders no day.
  const actions = useMemo<CalendarEntryActions>(
    () =>
      canMove
        ? {
            begin,
            moveBy: (item, fromDay, days) => moveBy.current(item, fromDay, days),
            ...(draggingId ? { draggingId } : null),
          }
        : {},
    [canMove, begin, moveBy, draggingId],
  );
  // Once the move shows in the model: focus the card where it landed; landed under a day's "+N more" (nothing to
  // focus), it stops looking rather than taking focus whenever the card next shows. Not landed yet: it waits.
  useEffect(() => {
    const id = refocus.current;
    if (!id) return;
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-calendar-item="${CSS.escape(id)}"]`,
    );
    if (el) el.focus();
    if (el || model.weeks.some((w) => w.some((d) => d.cards.some((c) => c.item.id === id))))
      refocus.current = null;
  }, [model]);
  const dragged = drag ? items.get(drag.itemId) : undefined;

  return (
    <ViewFrame
      title={`${copy.name} · ${model.label}`}
      count={model.count}
      countLabel={copy.count(model.count)}
      palette={palette}
      fontFamily={fontFamily}
      state={viewState(plan, true)}
      empty=""
      aside={
        <>
          {offset !== 0 ? (
            <ViewStepButton label="Today" onPress={() => setOffset(0)} palette={palette}>
              Today
            </ViewStepButton>
          ) : null}
          <ViewStepButton
            label="Previous Month"
            onPress={() => setOffset((o) => o - 1)}
            palette={palette}
          >
            <ChevronLeftIcon size={14} />
          </ViewStepButton>
          <ViewStepButton
            label="Next Month"
            onPress={() => setOffset((o) => o + 1)}
            palette={palette}
          >
            <ChevronRightIcon size={14} />
          </ViewStepButton>
        </>
      }
    >
      <div className="absolute inset-0 flex flex-col">
        <div className="grid shrink-0 grid-cols-7" style={{ color: palette.muted }}>
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="truncate px-1.5 py-1 text-[10px] font-semibold uppercase">
              {d}
            </span>
          ))}
        </div>
        <div
          ref={gridRef}
          data-calendar-grid=""
          className="relative grid min-h-0 flex-1 grid-cols-7 border-t"
          style={{
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            borderColor: palette.border,
          }}
        >
          {model.weeks.flat().map((cell) => (
            <DayCell
              key={cell.day}
              cell={cell}
              isToday={cell.day === today}
              isTarget={!!drag && drag.overDay === cell.day && drag.overDay !== drag.fromDay}
              palette={palette}
              colourOf={colourOf}
              plan={plan}
              room={room}
              asCards={asCards}
              actions={actions}
            />
          ))}
          {drag && dragged ? (
            <CalendarGhost
              ghost={ghost}
              item={dragged}
              width={drag.width}
              asCards={asCards}
              palette={palette}
              colour={colourOf(dragged.type)}
            />
          ) : null}
        </div>
        {model.count === 0 ? (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px]"
            style={{ color: palette.muted }}
          >
            {copy.empty}
          </span>
        ) : null}
      </div>
    </ViewFrame>
  );
}
