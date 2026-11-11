'use client';

// One board widget as drawn in the header (docs/specs/026-plan/board-widgets.md "Widget kinds"): every
// kind is a 28px pill in the board's own colours, so a row of them reads as one strip, each led by a
// picture of what it measures (a ring for completion, a bar split by type, a bar per column against its
// WIP limit, pips for votes). Filter, Only Mine and Not on Board are controls. The pictures are CSS, so
// they stay crisp at any zoom.
import {
  type BoardWidgetKind,
  doneColumnsOf,
  setColumnDone,
  quickNarrows,
} from '@liveplanner/items';
import { percentDone } from '@liveplanner/plan-art';
import { BoardFilterField } from './BoardFilterField';
import { SavedFilterChips } from './SavedFilterChips';
import {
  DONE_GREEN,
  Figure,
  Lead,
  NO_PLAN_ITEMS,
  WIDGET_PILL,
  type WidgetContext,
} from './board-widget-parts';
import { mineWidget, peopleWidget, typesWidget, unplacedWidget } from './board-widget-filters';
import {
  dueWidget,
  pointsWidget,
  prioritiesWidget,
  staleWidget,
  timeWidget,
  topVotedWidget,
  unassignedWidget,
  wipWidget,
} from './board-widget-measures';

export { PRESSABLE, WIDGET_PILL, type WidgetContext } from './board-widget-parts';

export function BoardWidgetView({ kind, ctx }: { kind: BoardWidgetKind; ctx: WidgetContext }) {
  const { palette, projection, setup } = ctx;
  const pill = { borderColor: palette.border, color: palette.muted };
  switch (kind) {
    case 'count': {
      // While anything narrows the board it reads "3 of 14", and pressing it shows everything again.
      const shown = projection.columns.reduce(
        (n, c) => n + c.lanes.reduce((m, l) => m + l.items.length, 0),
        0,
      );
      if (quickNarrows(ctx.quick))
        return (
          <button
            type="button"
            className={`${WIDGET_PILL} cursor-pointer transition hover:bg-black/5 dark:hover:bg-white/10`}
            style={{ borderColor: palette.focus, color: palette.muted }}
            onClick={() => ctx.onQuick({})}
            aria-label={`Showing ${shown} of ${projection.total} items. Show all`}
          >
            <Lead kind="count" color={palette.focus} />
            <Figure palette={palette}>{shown}</Figure>
            of {projection.total} · <span style={{ color: palette.focus }}>Show all</span>
          </button>
        );
      return (
        <span className={WIDGET_PILL} style={pill}>
          <Lead kind="count" color={palette.focus} />
          <Figure palette={palette}>{projection.total}</Figure>
          {projection.total === 1 ? 'item' : 'items'}
        </span>
      );
    }
    case 'progress': {
      if (doneColumnsOf(setup).length === 0) {
        // Pressing it makes the last column count as done, the column work usually ends in.
        const last = setup.columns[setup.columns.length - 1];
        return ctx.canEdit && last ? (
          <button
            type="button"
            className={`${WIDGET_PILL} cursor-pointer transition hover:bg-black/5 dark:hover:bg-white/10`}
            style={{ ...pill, borderStyle: 'dashed' }}
            onClick={() => ctx.onSetup(setColumnDone(setup, last.id, true), 'DoneColumn')}
          >
            <Lead kind="progress" color={palette.muted} />
            Set Done Column
          </button>
        ) : (
          <span className={WIDGET_PILL} style={pill}>
            <Lead kind="progress" color={palette.muted} />
            No done column
          </span>
        );
      }
      const pct = percentDone(projection.doneCount, projection.total);
      return (
        <span
          className={`${WIDGET_PILL} pl-1.5`}
          style={pill}
          role="img"
          aria-label={`${pct}% done, ${projection.doneCount} of ${projection.total}`}
        >
          {/* A ring filled to the share done. */}
          <span
            aria-hidden
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${DONE_GREEN} ${pct * 3.6}deg, ${palette.border} 0deg)`,
            }}
          >
            <span
              className="h-[11px] w-[11px] rounded-full"
              style={{ backgroundColor: palette.surface }}
            />
          </span>
          <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
            {pct}%
          </strong>
          <span>
            done · {projection.doneCount}/{projection.total}
          </span>
        </span>
      );
    }
    case 'filter':
      // The words and field chips as one field, then the board's saved filters (board-widgets.md "The Filter widget").
      return (
        <span className="flex shrink-0 items-center gap-1.5">
          <BoardFilterField
            projection={projection}
            planItems={ctx.planItems ?? NO_PLAN_ITEMS}
            types={ctx.types}
            statusNames={ctx.statusNames}
            palette={palette}
            quick={ctx.quick}
            onQuick={ctx.onQuick}
          />
          <SavedFilterChips
            setup={setup}
            palette={palette}
            quick={ctx.quick}
            onQuick={ctx.onQuick}
            mine={ctx.canFilterMine}
            now={ctx.now}
            canEdit={ctx.canEdit}
            onSetup={ctx.onSetup}
          />
        </span>
      );
    case 'mine':
      return mineWidget(ctx);
    case 'people':
      return peopleWidget(ctx, pill);
    case 'unplaced':
      return unplacedWidget(ctx, pill);
    case 'types':
      return typesWidget(ctx, pill);
    case 'wip':
      return wipWidget(ctx, pill);
    case 'due':
      return dueWidget(ctx, pill);
    case 'points':
      return pointsWidget(ctx, pill);
    case 'time':
      return timeWidget(ctx, pill);
    case 'priorities':
      return prioritiesWidget(ctx, pill);
    case 'unassigned':
      return unassignedWidget(ctx);
    case 'top-voted':
      return topVotedWidget(ctx, pill);
    case 'stale':
      return staleWidget(ctx, pill);
  }
}
