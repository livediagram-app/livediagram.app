'use client';

// The Due Calendar (docs/specs/026-plan/plan-views.md "Due Calendar"): a month in Monday weeks, each day
// listing the cards due then as a type dot and title, as many as fit and then "+N more". The month steps
// are each viewer's own.
import { useMemo, useState } from 'react';
import {
  ITEM_TYPES,
  WEEKDAY_SHORT,
  calendarModel,
  itemTitle,
  shiftMonth,
  todayNumber,
  typeIn,
} from '@livediagram/items';
import { ChevronLeftIcon, ChevronRightIcon } from '@livediagram/ui';
import { accentOn, type PlanPalette } from '../plan-palette';
import { ViewFrame, ViewStepButton, openProps, viewState } from './view-frame';
import type { PlanViewProps } from './PlanViewView';

const NO_PHASES = new Map();
// A day's entry height, and the room its date takes.
const ENTRY_H = 16;
const DATE_H = 18;
// The frame's header and the weekday row above the grid.
const FRAME_HEAD_H = 40;
const WEEKDAY_H = 22;

export function CalendarView({ plan, items, palette, fontFamily, height }: PlanViewProps) {
  const phases = plan?.statusPhases ?? NO_PHASES;
  const types = plan?.types ?? ITEM_TYPES;
  const now = new Date();
  const [offset, setOffset] = useState(0);
  // This month as one number, so the model is kept until the month, the cards or the step change.
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const model = useMemo(() => {
    const { year, month } = shiftMonth(Math.floor(thisMonth / 12), thisMonth % 12, offset);
    return calendarModel(items.values(), phases, year, month);
  }, [items, phases, thisMonth, offset]);
  const today = todayNumber(now);
  const rows = model.weeks.length;
  // The entries a day has room for, below its date.
  const room = Math.max(
    0,
    Math.floor(((height - FRAME_HEAD_H - WEEKDAY_H) / rows - DATE_H - 2) / ENTRY_H),
  );
  return (
    <ViewFrame
      title={`Due Calendar · ${model.label}`}
      count={model.due}
      countLabel={`${model.due} due`}
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
          className="grid min-h-0 flex-1 grid-cols-7 border-t"
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
              palette={palette}
              colourOf={(type) => accentOn(typeIn(types, type).color, palette)}
              plan={plan}
              room={room}
            />
          ))}
        </div>
        {model.due === 0 ? (
          <span
            className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[11px]"
            style={{ color: palette.muted }}
          >
            Nothing due this month.
          </span>
        ) : null}
      </div>
    </ViewFrame>
  );
}

function DayCell({
  cell,
  isToday,
  palette,
  colourOf,
  plan,
  room,
}: {
  cell: ReturnType<typeof calendarModel>['weeks'][number][number];
  isToday: boolean;
  palette: PlanPalette;
  colourOf: (type: string) => string;
  plan: PlanViewProps['plan'];
  room: number;
}) {
  // As many as fit, the last line kept for "+N more" when some do not.
  const shown = cell.cards.length > room ? cell.cards.slice(0, Math.max(0, room - 1)) : cell.cards;
  const more = cell.cards.length - shown.length;
  return (
    <div
      className="flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-r px-1 pb-0.5"
      style={{
        borderColor: palette.border,
        backgroundColor: cell.inMonth ? undefined : palette.column,
        opacity: cell.inMonth ? 1 : 0.7,
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
      <div className="flex min-h-0 flex-col overflow-hidden">
        {shown.map(({ item, done }) => (
          <button
            key={item.id}
            type="button"
            className="flex w-full min-w-0 shrink-0 cursor-pointer items-center gap-1 rounded px-0.5 text-left text-[10px] transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{ height: ENTRY_H, color: done ? palette.muted : palette.text }}
            aria-label={`#${item.key} ${itemTitle(item)}${done ? ', done' : ''}`}
            {...openProps(plan, item.id)}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: colourOf(item.type) }}
            />
            <span className={`min-w-0 truncate ${done ? 'line-through' : ''}`}>
              {itemTitle(item)}
            </span>
          </button>
        ))}
        {more > 0 ? (
          <span className="shrink-0 px-0.5 text-[10px]" style={{ color: palette.muted }}>
            +{more} more
          </span>
        ) : null}
      </div>
    </div>
  );
}
