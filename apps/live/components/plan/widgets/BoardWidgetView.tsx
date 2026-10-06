'use client';

// One board widget as drawn in the header (docs/specs/026-plan/board-widgets.md "Widget kinds"): every
// kind is a 28px pill in the board's own colours, so a row of them reads as one strip, each led by a
// picture of what it measures (a ring for completion, a bar split by type, a bar per column against its
// WIP limit, pips for votes). Filter, Only Mine and Not on Board are controls. The pictures are CSS, so
// they stay crisp at any zoom.
import {
  ITEM_TYPES,
  PRIORITY_LABELS,
  UNASSIGNED,
  dayKey,
  itemTitle,
  todayNumber,
  typeIn,
  type BoardProjection,
  type BoardWidgetKind,
  type Item,
  type ItemTypeDef,
  type PlanBoardSetup,
  type QuickFilter,
  type QuickDueWindow,
} from '@livediagram/items';
import { PRIORITY_COLOURS, accentOn, type PlanPalette } from '../plan-palette';
import { BoardWidgetArt } from '../plan-tile-art';
import { PersonDisc } from '../PersonDisc';
import {
  DUE_SOON_DAYS,
  STALE_DAYS,
  boardPoints,
  priorityCounts,
  staleCount,
  topVoted,
  unassignedCount,
  boardPeople,
  boardTypeCounts,
  dueCounts,
  overWipColumns,
} from './widget-stats';
import { OVERDUE_RED, PHASE_COLOURS } from '../views/view-frame';
import { CountBadge } from '@livediagram/ui';

const PEOPLE_SHOWN = 5;
const TYPES_SHOWN = 3;
// The most votes drawn as pips; a bigger budget is a number.
const VOTE_PIPS_MAX = 10;
const DONE_GREEN = PHASE_COLOURS.done;
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
  // Whether this viewer may change the board, and a change to its set-up (Set Done Column).
  canEdit: boolean;
  onSetup: (next: PlanBoardSetup, part: string) => void;
  // Open an item in the item panel (Top Voted).
  onOpenItem: (itemId: string) => void;
};

// The quick filter with the widget narrowings cleared, the text and Only Mine kept.
const WIDGET_KEYS = ['person', 'type', 'due', 'priority'] as const;
function narrowed(quick: QuickFilter): boolean {
  return (
    WIDGET_KEYS.some((k) => quick[k] !== undefined) || !!quick.text || quick.mine !== undefined
  );
}

// The quick filter with one widget narrowing set, or cleared when it is already the one set.
function toggle<K extends (typeof WIDGET_KEYS)[number]>(
  quick: QuickFilter,
  key: K,
  value: NonNullable<QuickFilter[K]>,
): QuickFilter {
  const next: QuickFilter = { ...quick };
  if (JSON.stringify(quick[key]) === JSON.stringify(value)) delete next[key];
  else next[key] = value;
  return next;
}

// A part of a widget that narrows the board when pressed, pressed while it does.
const PRESSABLE =
  'inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition enabled:cursor-pointer enabled:hover:bg-black/5 dark:enabled:hover:bg-white/10';

const stopKeys = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The widget's glyph, small, in a colour that says what it is about.
function Lead({ kind, color }: { kind: BoardWidgetKind; color: string }) {
  return (
    <span className="flex shrink-0 items-center" style={{ color }} aria-hidden>
      <BoardWidgetArt kind={kind} size={14} />
    </span>
  );
}

// A lone count in a widget: a badge, like a column's count.
function Figure({ children, palette }: { children: React.ReactNode; palette: PlanPalette }) {
  return (
    <CountBadge size="md" background={palette.column} color={palette.text}>
      {children}
    </CountBadge>
  );
}

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
      if (narrowed(ctx.quick))
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
      if (setup.doneColumnId === undefined) {
        // Pressing it makes the last column the done one, the column work usually ends in.
        const last = setup.columns[setup.columns.length - 1];
        return ctx.canEdit && last ? (
          <button
            type="button"
            className={`${WIDGET_PILL} cursor-pointer transition hover:bg-black/5 dark:hover:bg-white/10`}
            style={{ ...pill, borderStyle: 'dashed' }}
            onClick={() => ctx.onSetup({ ...setup, doneColumnId: last.id }, 'DoneColumn')}
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
          <strong className="font-semibold tabular-nums" style={{ color: palette.text }}>
            {pct}%
          </strong>
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
            {ctx.items.length === 0 ? 'No people yet' : 'No one assigned'}
          </span>
        );
      const extra = people.length - PEOPLE_SHOWN;
      return (
        <span
          className={`${WIDGET_PILL} pl-1`}
          style={pill}
          role="group"
          aria-label={`People on this board: ${people.map((p) => p.name).join(', ')}`}
        >
          <span className="flex -space-x-0.5">
            {people.slice(0, PEOPLE_SHOWN).map((p) => {
              const on = ctx.quick.person === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Only ${p.name}'s cards`}
                  className="cursor-pointer rounded-full ring-2 transition hover:z-10 hover:scale-110"
                  style={{
                    ['--tw-ring-color' as string]: on ? palette.focus : palette.surface,
                    opacity: ctx.quick.person && !on ? 0.45 : 1,
                  }}
                  onClick={() => ctx.onQuick(toggle(ctx.quick, 'person', p.id))}
                >
                  <PersonDisc person={p} />
                </button>
              );
            })}
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
          role="group"
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
          {counts.slice(0, TYPES_SHOWN).map((c) => {
            const on = ctx.quick.type === c.def.id;
            return (
              <button
                key={c.def.id}
                type="button"
                aria-pressed={on}
                aria-label={`Only ${c.def.label} cards, ${c.count}`}
                className={PRESSABLE}
                style={{
                  backgroundColor: on ? `${palette.focus}1f` : undefined,
                  opacity: ctx.quick.type && !on ? 0.5 : 1,
                }}
                onClick={() => ctx.onQuick(toggle(ctx.quick, 'type', c.def.id))}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: accentOn(c.def.color, palette) }}
                />
                {c.def.label}
                <Figure palette={palette}>{c.count}</Figure>
              </button>
            );
          })}
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
    case 'due': {
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
      const doneStatus = setup.columns.find((c) => c.id === setup.doneColumnId)?.status;
      const tag = (n: number, color: string, label: string, window: QuickDueWindow) => {
        const value = doneStatus ? { ...window, doneStatus } : window;
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
    case 'points': {
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
    case 'priorities': {
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
    case 'unassigned': {
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
    case 'top-voted': {
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
          aria-label={`Top voted: ${itemTitle(top.item)}, ${top.votes} votes. Open it`}
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
    case 'stale': {
      const n = staleCount(setup, ctx.items, ctx.now);
      return (
        <span
          className={WIDGET_PILL}
          style={n > 0 ? { borderColor: SOON_AMBER, color: palette.muted } : pill}
          role="img"
          aria-label={
            n > 0
              ? `${n} cards unchanged for ${STALE_DAYS} days`
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
  }
}
