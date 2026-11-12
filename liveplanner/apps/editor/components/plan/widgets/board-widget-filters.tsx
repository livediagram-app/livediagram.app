'use client';

// The board widgets that narrow the board when pressed (docs/specs/026-plan/board-widgets.md "Widget kinds"): Only
// Mine, the people on the board, the cards not on it, and the bar split by type. Drawn for BoardWidgetView, which
// picks the kind; plain functions, not components, so the header's tree is the one it always was.
import { typeIn, type ItemTypeDef } from '@liveplanner/items';
import { accentOn } from '../plan-palette';
import { PersonDisc } from '../PersonDisc';
import { boardPeople, boardTypeCounts } from '@liveplanner/plan-art';
import {
  Figure,
  Lead,
  PEOPLE_SHOWN,
  PRESSABLE,
  SOON_AMBER,
  TYPES_SHOWN,
  WIDGET_PILL,
  toggle,
  type WidgetContext,
  type WidgetPill,
} from './board-widget-parts';

export function mineWidget(ctx: WidgetContext): React.JSX.Element {
  const { palette } = ctx;
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
            ? {
                text: ctx.quick.text,
                ...(ctx.quick.filters ? { filters: ctx.quick.filters } : {}),
              }
            : { ...ctx.quick, mine: ctx.canFilterMine ?? undefined },
        )
      }
    >
      <Lead kind="mine" color="currentColor" />
      Only Mine
    </button>
  );
}

export function peopleWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette } = ctx;
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

export function unplacedWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette, projection } = ctx;
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

export function typesWidget(ctx: WidgetContext, pill: WidgetPill): React.JSX.Element {
  const { palette } = ctx;
  // Counted by the type each item reads as, so items of a type the catalogue no longer has join
  // the type they show as.
  const catalogue = ctx.types;
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
