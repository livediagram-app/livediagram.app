'use client';

// One board widget as drawn in the header (docs/specs/025-plan/board-widgets.md "Widget kinds"): every
// kind is a 28px pill in the board's own colours, so a row of them reads as one strip. Read-outs are
// plain; Filter, Only Mine and Not on Board are controls.
import {
  ITEM_TYPES,
  typeIn,
  type BoardProjection,
  type BoardWidgetKind,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
  type QuickFilter,
} from '@livediagram/items';
import { accentOn, type PlanPalette } from '../plan-palette';
import { PersonDisc } from '../PersonDisc';
import { boardPeople, boardTypeCounts, dueCounts, overWipColumns } from './widget-stats';

const PEOPLE_SHOWN = 5;
const TYPES_SHOWN = 5;

export const WIDGET_PILL =
  'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-2 text-[12px] font-medium';

export type WidgetContext = {
  setup: PlanBoardSetup;
  projection: BoardProjection;
  // The items the board shows (status is one of its columns), unfiltered.
  items: readonly Item[];
  types: readonly ItemTypeDef[];
  palette: PlanPalette;
  quick: QuickFilter;
  onQuick: (q: QuickFilter) => void;
  // The viewer's person id, when they can be "mine".
  canFilterMine: string | null;
  votesLeft: number | null;
  trayOpen: boolean;
  onToggleTray: () => void;
  now: Date;
};

const stopKeys = (e: { stopPropagation: () => void }) => e.stopPropagation();

export function BoardWidgetView({ kind, ctx }: { kind: BoardWidgetKind; ctx: WidgetContext }) {
  const { palette, projection, setup } = ctx;
  const pill = { borderColor: palette.border, color: palette.muted };
  switch (kind) {
    case 'count':
      return (
        <span className={WIDGET_PILL} style={pill}>
          <strong className="font-semibold" style={{ color: palette.text }}>
            {projection.total}
          </strong>
          {projection.total === 1 ? 'item' : 'items'}
        </span>
      );
    case 'progress': {
      if (setup.doneColumnId === undefined)
        return (
          <span className={WIDGET_PILL} style={pill}>
            No done column
          </span>
        );
      const pct = projection.total
        ? Math.round((projection.doneCount / projection.total) * 100)
        : 0;
      return (
        <span
          className={WIDGET_PILL}
          style={pill}
          role="img"
          aria-label={`${pct}% done, ${projection.doneCount} of ${projection.total}`}
        >
          <span
            className="h-1.5 w-16 overflow-hidden rounded-full"
            style={{ backgroundColor: palette.column }}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: '#16a34a' }}
            />
          </span>
          <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
            {pct}%
          </strong>
          done
        </span>
      );
    }
    case 'filter':
      return (
        <input
          type="search"
          value={ctx.quick.text ?? ''}
          onChange={(e) => ctx.onQuick({ ...ctx.quick, text: e.target.value })}
          onKeyDown={stopKeys}
          placeholder="Filter"
          aria-label="Filter this board"
          className="h-7 w-32 shrink-0 rounded-md border bg-transparent px-2 text-[12px] outline-none"
          style={{ borderColor: palette.border, color: palette.text }}
        />
      );
    case 'mine': {
      const on = ctx.quick.mine !== undefined;
      return (
        <button
          type="button"
          className={`${WIDGET_PILL} transition enabled:cursor-pointer disabled:opacity-50`}
          aria-pressed={on}
          disabled={!ctx.canFilterMine}
          style={{
            borderColor: on ? palette.focus : palette.border,
            color: on ? palette.focus : palette.muted,
          }}
          onClick={() =>
            ctx.onQuick(
              on
                ? { text: ctx.quick.text }
                : { ...ctx.quick, mine: ctx.canFilterMine ?? undefined },
            )
          }
        >
          Only Mine
        </button>
      );
    }
    case 'people': {
      const people = boardPeople(ctx.items);
      if (people.length === 0)
        return (
          <span className={WIDGET_PILL} style={pill}>
            No one assigned
          </span>
        );
      const extra = people.length - PEOPLE_SHOWN;
      return (
        <span
          className={`${WIDGET_PILL} pl-1`}
          style={pill}
          role="img"
          aria-label={`People on this board: ${people.map((p) => p.name).join(', ')}`}
        >
          <span className="flex -space-x-1">
            {people.slice(0, PEOPLE_SHOWN).map((p) => (
              <span
                key={p.id}
                className="rounded-full ring-2"
                style={{ ['--tw-ring-color' as string]: palette.surface }}
              >
                <PersonDisc person={p} />
              </span>
            ))}
          </span>
          {extra > 0 ? <span>+{extra}</span> : null}
        </span>
      );
    }
    case 'unplaced': {
      const n = projection.unplaced.length;
      return (
        <button
          type="button"
          className={`${WIDGET_PILL} transition enabled:cursor-pointer disabled:cursor-default`}
          style={pill}
          disabled={n === 0}
          aria-expanded={n > 0 ? ctx.trayOpen : undefined}
          onClick={ctx.onToggleTray}
        >
          {n === 0 ? 'All on board' : `${n} not on board`}
        </button>
      );
    }
    case 'types': {
      // Counted by the type each item reads as, so items of a type the catalogue no longer has join
      // the type they show as.
      const catalogue = ctx.types.length ? ctx.types : ITEM_TYPES;
      const merged = new Map<string, { def: ItemTypeDef; count: number }>();
      for (const { type, count } of boardTypeCounts(
        ctx.items,
        catalogue.map((t) => t.id),
      )) {
        const def = typeIn(catalogue, type);
        const row = merged.get(def.id);
        if (row) row.count += count;
        else merged.set(def.id, { def, count });
      }
      const counts = [...merged.values()];
      if (counts.length === 0)
        return (
          <span className={WIDGET_PILL} style={pill}>
            No cards
          </span>
        );
      return (
        <span className={`${WIDGET_PILL} gap-2.5`} style={pill}>
          {counts.slice(0, TYPES_SHOWN).map(({ def, count }) => {
            return (
              <span
                key={def.id}
                className="inline-flex items-center gap-1"
                aria-label={`${count} ${def.label}`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: accentOn(def.color, palette) }}
                  aria-hidden
                />
                <span aria-hidden>{def.label}</span>
                <strong
                  aria-hidden
                  className="font-semibold tabular-nums"
                  style={{ color: palette.text }}
                >
                  {count}
                </strong>
              </span>
            );
          })}
        </span>
      );
    }
    case 'wip': {
      const over = overWipColumns(projection);
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
        >
          {over > 0 ? `${over} over WIP` : 'Within WIP'}
        </span>
      );
    }
    case 'due': {
      const { overdue, soon } = dueCounts(setup, ctx.items, ctx.now);
      if (overdue === 0 && soon === 0)
        return (
          <span className={WIDGET_PILL} style={pill}>
            Nothing due
          </span>
        );
      return (
        <span className={WIDGET_PILL} style={pill}>
          {overdue > 0 ? (
            <strong className="font-semibold" style={{ color: palette.warning }}>
              {overdue} overdue
            </strong>
          ) : null}
          {overdue > 0 && soon > 0 ? <span aria-hidden>·</span> : null}
          {soon > 0 ? <span>{soon} due soon</span> : null}
        </span>
      );
    }
    case 'votes':
      if (ctx.votesLeft === null) return null;
      return (
        <span className={WIDGET_PILL} style={pill}>
          Votes left
          <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
            {ctx.votesLeft}
          </strong>
        </span>
      );
  }
}
