'use client';

// One board widget as drawn in the header (docs/specs/025-plan/board-widgets.md "Widget kinds"): every
// kind is a 28px pill in the board's own colours, so a row of them reads as one strip, each led by a
// picture of what it measures (a ring for completion, a bar split by type, a bar per column against its
// WIP limit, pips for votes). Filter, Only Mine and Not on Board are controls. The pictures are CSS, so
// they stay crisp at any zoom.
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
import { BoardWidgetArt } from '../plan-tile-art';
import { PersonDisc } from '../PersonDisc';
import { boardPeople, boardTypeCounts, dueCounts, overWipColumns } from './widget-stats';

const PEOPLE_SHOWN = 5;
const TYPES_SHOWN = 3;
// The most votes drawn as pips; a bigger budget is a number.
const VOTE_PIPS_MAX = 10;
const DONE_GREEN = '#16a34a';
const OVERDUE_RED = '#dc2626';
const SOON_AMBER = '#d97706';

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

// The widget's glyph, small, in a colour that says what it is about.
function Lead({ kind, color }: { kind: BoardWidgetKind; color: string }) {
  return (
    <span className="flex shrink-0 items-center" style={{ color }} aria-hidden>
      <BoardWidgetArt kind={kind} size={14} />
    </span>
  );
}

// A figure in the widget, in the board's text colour.
function Figure({ children, palette }: { children: React.ReactNode; palette: PlanPalette }) {
  return (
    <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
      {children}
    </strong>
  );
}

export function BoardWidgetView({ kind, ctx }: { kind: BoardWidgetKind; ctx: WidgetContext }) {
  const { palette, projection, setup } = ctx;
  const pill = { borderColor: palette.border, color: palette.muted };
  switch (kind) {
    case 'count':
      return (
        <span className={WIDGET_PILL} style={pill}>
          <Lead kind="count" color={palette.focus} />
          <Figure palette={palette}>{projection.total}</Figure>
          {projection.total === 1 ? 'item' : 'items'}
        </span>
      );
    case 'progress': {
      if (setup.doneColumnId === undefined)
        return (
          <span className={WIDGET_PILL} style={pill}>
            <Lead kind="progress" color={palette.muted} />
            No done column
          </span>
        );
      const pct = projection.total
        ? Math.round((projection.doneCount / projection.total) * 100)
        : 0;
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
          <Figure palette={palette}>{pct}%</Figure>
          <span>
            done · {projection.doneCount}/{projection.total}
          </span>
        </span>
      );
    }
    case 'filter': {
      const on = !!ctx.quick.text;
      return (
        <span className="relative flex shrink-0 items-center">
          <span
            className="pointer-events-none absolute left-2 flex"
            style={{ color: on ? palette.focus : palette.muted }}
            aria-hidden
          >
            <BoardWidgetArt kind="filter" size={13} />
          </span>
          <input
            type="search"
            value={ctx.quick.text ?? ''}
            onChange={(e) => ctx.onQuick({ ...ctx.quick, text: e.target.value })}
            onKeyDown={stopKeys}
            placeholder="Filter cards"
            aria-label="Filter this board"
            className="h-7 w-36 rounded-md border bg-transparent pl-7 pr-2 text-[12px] outline-none"
            style={{ borderColor: on ? palette.focus : palette.border, color: palette.text }}
          />
        </span>
      );
    }
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
            backgroundColor: on ? `${palette.focus}1f` : undefined,
          }}
          onClick={() =>
            ctx.onQuick(
              on
                ? { text: ctx.quick.text }
                : { ...ctx.quick, mine: ctx.canFilterMine ?? undefined },
            )
          }
        >
          <Lead kind="mine" color="currentColor" />
          Only Mine
        </button>
      );
    }
    case 'people': {
      const people = boardPeople(ctx.items);
      if (people.length === 0)
        return (
          <span className={WIDGET_PILL} style={pill}>
            <Lead kind="people" color={palette.muted} />
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
          <span className="flex -space-x-0.5">
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
          <span>{people.length === 1 ? '1 person' : `${people.length} people`}</span>
        </span>
      );
    }
    case 'unplaced': {
      const n = projection.unplaced.length;
      return (
        <button
          type="button"
          className={`${WIDGET_PILL} transition enabled:cursor-pointer disabled:cursor-default`}
          style={n > 0 ? { borderColor: SOON_AMBER, color: palette.muted } : pill}
          disabled={n === 0}
          aria-expanded={n > 0 ? ctx.trayOpen : undefined}
          onClick={ctx.onToggleTray}
        >
          <Lead kind="unplaced" color={n > 0 ? SOON_AMBER : palette.muted} />
          {n === 0 ? (
            'All on board'
          ) : (
            <>
              <Figure palette={palette}>{n}</Figure> not on board
            </>
          )}
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
      const total = counts.reduce((n, c) => n + c.count, 0);
      if (total === 0)
        return (
          <span className={WIDGET_PILL} style={pill}>
            <Lead kind="types" color={palette.muted} />
            No cards
          </span>
        );
      return (
        <span
          className={`${WIDGET_PILL} gap-2`}
          style={pill}
          role="img"
          aria-label={counts.map((c) => `${c.count} ${c.def.label}`).join(', ')}
        >
          {/* The board's cards as one bar, a stretch per type in its colour. */}
          <span
            aria-hidden
            className="flex h-2 w-16 overflow-hidden rounded-full"
            style={{ backgroundColor: palette.column }}
          >
            {counts.map((c) => (
              <span
                key={c.def.id}
                className="h-full"
                style={{
                  width: `${(c.count / total) * 100}%`,
                  backgroundColor: accentOn(c.def.color, palette),
                }}
              />
            ))}
          </span>
          {counts.slice(0, TYPES_SHOWN).map((c) => (
            <span key={c.def.id} aria-hidden className="inline-flex items-center gap-1">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: accentOn(c.def.color, palette) }}
              />
              {c.def.label}
              <Figure palette={palette}>{c.count}</Figure>
            </span>
          ))}
        </span>
      );
    }
    case 'wip': {
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
            over > 0 ? `${over} columns over their WIP limit` : 'Every column within its WIP limit'
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
              <strong className="font-semibold tabular-nums">{over}</strong> over WIP
            </>
          ) : (
            'Within WIP'
          )}
        </span>
      );
    }
    case 'due': {
      const { overdue, soon } = dueCounts(setup, ctx.items, ctx.now);
      if (overdue === 0 && soon === 0)
        return (
          <span className={WIDGET_PILL} style={pill}>
            <Lead kind="due" color={DONE_GREEN} />
            Nothing due
          </span>
        );
      const tag = (n: number, color: string, label: string) => (
        <span className="inline-flex items-center gap-1">
          <span
            className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ backgroundColor: `${color}26`, color }}
          >
            {n}
          </span>
          {label}
        </span>
      );
      return (
        <span className={`${WIDGET_PILL} gap-2`} style={pill}>
          <Lead kind="due" color={overdue > 0 ? OVERDUE_RED : SOON_AMBER} />
          {overdue > 0 ? tag(overdue, OVERDUE_RED, 'overdue') : null}
          {soon > 0 ? tag(soon, SOON_AMBER, 'due soon') : null}
        </span>
      );
    }
    case 'votes': {
      if (ctx.votesLeft === null) return null;
      const budget = setup.voting.budget;
      const pips = budget !== undefined && budget <= VOTE_PIPS_MAX;
      return (
        <span
          className={WIDGET_PILL}
          style={pill}
          role="img"
          aria-label={`${ctx.votesLeft} votes left${budget ? ` of ${budget}` : ''}`}
        >
          <Lead kind="votes" color={palette.focus} />
          {pips ? (
            // A pip per vote of the budget, filled while it is still to spend.
            <span aria-hidden className="flex items-center gap-[3px]">
              {Array.from({ length: budget }, (_, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full border"
                  style={{
                    borderColor: palette.focus,
                    backgroundColor: i < (ctx.votesLeft ?? 0) ? palette.focus : 'transparent',
                  }}
                />
              ))}
            </span>
          ) : (
            <Figure palette={palette}>{ctx.votesLeft}</Figure>
          )}
          <span aria-hidden>left</span>
        </span>
      );
    }
  }
}
