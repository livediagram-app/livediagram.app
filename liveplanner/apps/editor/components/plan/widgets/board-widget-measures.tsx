'use client';

// The board widgets that measure the board (docs/specs/026-plan/board-widgets.md "Widget kinds"): WIP limits, due
// dates, points, time, priorities, unassigned cards, the top voted card and stale cards. Drawn for BoardWidgetView,
// which picks the kind; plain functions, not components, so the header's tree is the one it always was.
import { plural } from '@liveplanner/project';
import {
  PRIORITY_LABELS,
  UNASSIGNED,
  dayKey,
  itemTitle,
  todayNumber,
  durationSpoken,
  durationText,
  finishedStatuses,
  type QuickDueWindow,
} from '@liveplanner/items';
import { PRIORITY_COLOURS } from '../plan-palette';
import {
  DUE_SOON_DAYS,
  STALE_DAYS,
  boardPoints,
  boardTime,
  priorityCounts,
  staleCount,
  topVoted,
  unassignedCount,
  dueCounts,
  overWipColumns,
} from '@liveplanner/plan-art';
import { OVERDUE_RED } from '../views/view-frame';
import { CountBadge } from '@liveplanner/ui';
import { RunningDot } from '../time/TimerReadouts';
import {
  DONE_GREEN,
  Figure,
  Lead,
  PRESSABLE,
  SOON_AMBER,
  WIDGET_PILL,
  toggle,
  type WidgetContext,
  type WidgetPill,
} from './board-widget-parts';

export function wipWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette, projection } = ctx;
  const over = overWipColumns(projection);
  const most = Math.max(1, ...projection.columns.map((c) => c.count));
  return (
    <span
      className={WIDGET_PILL}
      style={
        over > 0
          ? {
              borderColor: palette.warning,
              color: palette.warning,
              backgroundColor: palette.warningBg,
            }
          : pill
      }
      role="img"
      aria-label={
        over > 0
          ? `${plural(over, 'column')} over ${over === 1 ? 'its' : 'their'} WIP limit`
          : 'Every column within its WIP limit'
      }
    >
      {/* A bar per column: its cards against its limit (or the busiest column), warning when over. */}
      <span aria-hidden className="flex h-4 items-end gap-[2px]">
        {projection.columns.map((c) => {
          const limit = c.column.wipLimit;
          const share = Math.min(1, c.count / (limit ?? most));
          return (
            <span
              key={c.column.id}
              className="w-[3px] rounded-full"
              style={{
                height: `${Math.max(2, Math.round(share * 16))}px`,
                backgroundColor: c.overLimit
                  ? palette.warning
                  : limit
                    ? palette.focus
                    : palette.border,
              }}
            />
          );
        })}
      </span>
      {over > 0 ? (
        <>
          <CountBadge size="md" background={palette.surface} color={palette.warning}>
            {over}
          </CountBadge>
          over WIP
        </>
      ) : (
        'Within WIP'
      )}
    </span>
  );
}

export function dueWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { setup } = ctx;
  const { overdue, soon } = dueCounts(setup, ctx.items, ctx.now);
  if (overdue === 0 && soon === 0)
    return (
      <span className={WIDGET_PILL} style={pill}>
        <Lead kind="due" color={DONE_GREEN} />
        Nothing due
      </span>
    );
  const today = todayNumber(ctx.now);
  // Each count narrows the board to exactly the cards it counts, not done: overdue (due by
  // yesterday), or due from today to a week out.
  const finished = finishedStatuses(setup);
  const tag = (n: number, color: string, label: string, window: QuickDueWindow) => {
    const value = finished.length > 0 ? { ...window, finished } : window;
    const on = JSON.stringify(ctx.quick.due) === JSON.stringify(value);
    return (
      <button
        type="button"
        aria-pressed={on}
        className={PRESSABLE}
        style={{ backgroundColor: on ? `${color}1f` : undefined }}
        onClick={() => ctx.onQuick(toggle(ctx.quick, 'due', value))}
      >
        <CountBadge size="md" background={`${color}26`} color={color}>
          {n}
        </CountBadge>
        {label}
      </button>
    );
  };
  return (
    <span className={`${WIDGET_PILL} gap-2`} style={pill}>
      <Lead kind="due" color={overdue > 0 ? OVERDUE_RED : SOON_AMBER} />
      {overdue > 0 ? tag(overdue, OVERDUE_RED, 'overdue', { to: dayKey(today - 1) }) : null}
      {soon > 0
        ? tag(soon, SOON_AMBER, 'due soon', {
            from: dayKey(today),
            to: dayKey(today + DUE_SOON_DAYS),
          })
        : null}
    </span>
  );
}

export function pointsWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette, setup } = ctx;
  const { done, total, estimated } = boardPoints(setup, ctx.items);
  if (estimated === 0)
    return (
      <span className={WIDGET_PILL} style={pill}>
        <Lead kind="points" color={palette.muted} />
        No estimates
      </span>
    );
  const share = total ? done / total : 0;
  return (
    <span
      className={WIDGET_PILL}
      style={pill}
      role="img"
      aria-label={`${done} of ${total} points done`}
    >
      <Lead kind="points" color={DONE_GREEN} />
      <span
        aria-hidden
        className="h-1.5 w-14 overflow-hidden rounded-full"
        style={{ backgroundColor: palette.border }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${share * 100}%`, backgroundColor: DONE_GREEN }}
        />
      </span>
      <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
        {done}/{total}
      </strong>
      pts
    </span>
  );
}

// Hours on the board's cards, and the timers running now (docs/specs/026-plan/board-widgets.md "Time").
export function timeWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette } = ctx;
  const { minutes, counted, running } = boardTime(ctx.items, ctx.types);
  if (counted === 0 && running === 0)
    return (
      <span className={WIDGET_PILL} style={pill}>
        <Lead kind="time" color={palette.muted} />
        No time yet
      </span>
    );
  const spoken = `${durationSpoken(minutes)} tracked${
    running ? `, ${running} ${running === 1 ? 'timer' : 'timers'} running` : ''
  }`;
  return (
    <span className={WIDGET_PILL} style={pill} role="img" aria-label={spoken}>
      <Lead kind="time" color={palette.text} />
      <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
        {durationText(minutes)}
      </strong>
      {running ? (
        <span className="inline-flex items-center gap-1">
          <RunningDot />
          {running} running
        </span>
      ) : null}
    </span>
  );
}

export function prioritiesWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette } = ctx;
  const counts = priorityCounts(ctx.items);
  if (counts.length === 0)
    return (
      <span className={WIDGET_PILL} style={pill}>
        <Lead kind="priorities" color={palette.muted} />
        No priorities
      </span>
    );
  return (
    <span
      className={`${WIDGET_PILL} gap-1 pl-1.5`}
      style={pill}
      role="group"
      aria-label="Cards by priority"
    >
      <Lead kind="priorities" color={PRIORITY_COLOURS[counts[0]!.priority]} />
      {counts.map(({ priority, count }) => {
        const on = ctx.quick.priority === priority;
        return (
          <button
            key={priority}
            type="button"
            aria-pressed={on}
            aria-label={`Only ${PRIORITY_LABELS[priority]} priority, ${count}`}
            className={PRESSABLE}
            style={{
              backgroundColor: on ? `${PRIORITY_COLOURS[priority]}26` : undefined,
              opacity: ctx.quick.priority && !on ? 0.5 : 1,
            }}
            onClick={() => ctx.onQuick(toggle(ctx.quick, 'priority', priority))}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: PRIORITY_COLOURS[priority] }}
            />
            <CountBadge size="md" background={palette.column} color={palette.text}>
              {count}
            </CountBadge>
          </button>
        );
      })}
    </span>
  );
}

export function unassignedWidget(ctx: WidgetContext): React.JSX.Element {
  const { palette } = ctx;
  const n = unassignedCount(ctx.items);
  const on = ctx.quick.person === UNASSIGNED;
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={n === 0 && !on}
      className={`${WIDGET_PILL} transition enabled:cursor-pointer enabled:hover:bg-black/5 dark:enabled:hover:bg-white/10`}
      style={{
        borderColor: on ? palette.focus : n > 0 ? SOON_AMBER : palette.border,
        color: palette.muted,
        backgroundColor: on ? `${palette.focus}1f` : undefined,
      }}
      onClick={() => ctx.onQuick(toggle(ctx.quick, 'person', UNASSIGNED))}
    >
      <Lead
        kind="unassigned"
        color={n > 0 ? SOON_AMBER : ctx.items.length === 0 ? palette.muted : DONE_GREEN}
      />
      {ctx.items.length === 0 ? (
        'Nothing to assign'
      ) : n === 0 ? (
        'All assigned'
      ) : (
        <>
          <Figure palette={palette}>{n}</Figure> unassigned
        </>
      )}
    </button>
  );
}

export function topVotedWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette } = ctx;
  const top = topVoted(ctx.items);
  if (!top)
    return (
      <span className={WIDGET_PILL} style={pill}>
        <Lead kind="top-voted" color={palette.muted} />
        No votes yet
      </span>
    );
  return (
    <button
      type="button"
      className={`${WIDGET_PILL} max-w-[16rem] cursor-pointer transition hover:bg-black/5 dark:hover:bg-white/10`}
      style={pill}
      aria-label={`Top voted: ${itemTitle(top.item)}, ${plural(top.votes, 'vote')}. Open it`}
      onClick={() => ctx.onOpenItem(top.item.id)}
    >
      <Lead kind="top-voted" color={SOON_AMBER} />
      <CountBadge size="md" background={`${SOON_AMBER}26`} color={SOON_AMBER}>
        ▲ {top.votes}
      </CountBadge>
      <span className="truncate" style={{ color: palette.text }}>
        {itemTitle(top.item) || 'Untitled'}
      </span>
    </button>
  );
}

export function staleWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette, setup } = ctx;
  const n = staleCount(setup, ctx.items, ctx.now);
  return (
    <span
      className={WIDGET_PILL}
      style={n > 0 ? { borderColor: SOON_AMBER, color: palette.muted } : pill}
      role="img"
      aria-label={
        n > 0
          ? `${plural(n, 'card')} unchanged for ${STALE_DAYS} days`
          : `Every card changed in the last ${STALE_DAYS} days`
      }
    >
      <Lead kind="stale" color={n > 0 ? SOON_AMBER : palette.muted} />
      {n > 0 ? (
        <>
          <Figure palette={palette}>{n}</Figure> stale
        </>
      ) : (
        'Nothing stale'
      )}
    </span>
  );
}
