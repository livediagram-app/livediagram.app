'use client';

// The Gantt chart's names column (docs/specs/026-plan/plan-views.md "Gantt Chart", "Status",
// "Swimlanes", "Row order"): a row's colour dot, #key, title, status pill and children's progress, with a grip at
// its left edge (on hover or focus, to an editor) that drags it to a new place; and a swimlane's header, a
// collapsible band naming its lane.
import {
  ITEM_TYPES,
  STATUS_PHASE_LABELS,
  itemColourOf,
  itemTitle,
  phaseOf,
  statusLabel,
  type GanttRow,
  type ItemTypeDef,
  type LaneHead,
  type StatusPhase,
  namedStatus,
} from '@livediagram/items';
import { Tooltip } from '@livediagram/ui';
import type { PlanPalette } from '../plan-palette';
import { PHASE_COLOURS, openProps } from './view-frame';
import type { PlanViewProps } from './PlanViewView';
import { ColourDot } from '../ColourSwatches';
import { PersonDisc } from '../PersonDisc';
import { PlanTypeGlyph } from '../plan-type-glyph';
import { tint } from '../plan-card-parts';

// Under this names column width a row's status is a dot, named in a tooltip.
export const GANTT_PILL_MIN_COLUMN_PX = 160;

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// A row's status: its name (as the boards name it) and the phase that colours it, or null with no status.
export function rowStatus(
  row: GanttRow,
  phases: ReadonlyMap<string, StatusPhase>,
  statusNames?: ReadonlyMap<string, string>,
): { name: string; phase: StatusPhase } | null {
  const s = namedStatus(row.item, statusNames);
  if (!s) return null;
  return { name: statusLabel(s, statusNames), phase: phaseOf(row.item, phases) };
}

export function GanttStatusPill({
  status,
  narrow,
}: {
  status: { name: string; phase: StatusPhase };
  // The names column is too narrow for the name: a dot, named in a tooltip.
  narrow: boolean;
}) {
  const colour = PHASE_COLOURS[status.phase];
  if (narrow)
    return (
      <Tooltip label={status.name}>
        <span
          role="img"
          aria-label={status.name}
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: colour }}
        />
      </Tooltip>
    );
  return (
    <span
      className="inline-flex h-[18px] max-w-[45%] shrink-0 items-center truncate rounded-md px-1.5 text-[10px] font-semibold"
      style={{ backgroundColor: tint(colour, 18), color: colour }}
      data-phase={STATUS_PHASE_LABELS[status.phase]}
    >
      <span className="truncate">{status.name}</span>
    </span>
  );
}

// What reordering a row needs: the grip's press (given the row's element, to read its on-screen height) and a
// keyboard move one place.
export type GanttRowReorderProps = {
  onGripDown: (row: HTMLElement | null) => (e: React.PointerEvent) => void;
  onMove: (by: -1 | 1) => void;
};

export function GanttNameRow({
  row,
  status,
  narrow,
  plan,
  palette,
  top,
  height,
  reorder,
  lift,
}: {
  row: GanttRow;
  status: { name: string; phase: StatusPhase } | null;
  narrow: boolean;
  plan: PlanViewProps['plan'];
  palette: PlanPalette;
  top: number;
  height: number;
  // Present when the rows may be reordered (an editor, the chart taking input).
  reorder?: GanttRowReorderProps | undefined;
  // While this row is dragged: how far it has travelled (chart px).
  lift?: number | undefined;
}) {
  const kids = row.total ? `${row.done}/${row.total}` : '';
  const own = itemColourOf(row.item);
  const lifted = lift !== undefined;
  return (
    <div
      data-gantt-row={row.item.id}
      className={`group absolute inset-x-0 ${lifted ? 'z-20 shadow-md' : ''}`}
      style={{
        top,
        height,
        ...(lifted ? { transform: `translateY(${lift}px)`, backgroundColor: palette.surface } : {}),
      }}
    >
      <button
        type="button"
        className="flex h-full w-full min-w-0 cursor-pointer items-center gap-1.5 px-3 text-left text-[12px] transition hover:bg-black/5 dark:hover:bg-white/10"
        aria-label={`#${row.item.key} ${itemTitle(row.item)}${status ? `, ${status.name}` : ''}${kids ? `, ${row.done} of ${row.total} done` : ''}`}
        {...openProps(plan, row.item.id)}
        onKeyDown={
          reorder
            ? (e) => {
                if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
                e.preventDefault();
                e.stopPropagation();
                reorder.onMove(e.key === 'ArrowUp' ? -1 : 1);
              }
            : undefined
        }
      >
        {own ? <ColourDot colour={own} /> : null}
        <span className="shrink-0 tabular-nums" style={{ color: palette.muted }}>
          #{row.item.key}
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">{itemTitle(row.item)}</span>
        {status ? <GanttStatusPill status={status} narrow={narrow} /> : null}
        {kids ? (
          <span className="shrink-0 tabular-nums text-[11px]" style={{ color: palette.muted }}>
            {kids}
          </span>
        ) : null}
      </button>
      {reorder ? <GanttRowGrip palette={palette} onGripDown={reorder.onGripDown} /> : null}
    </div>
  );
}

// A row's grip: six dots at its left edge, shown while the row is hovered or focused; pressed, it drags the row.
// A plain click on it does nothing.
export function GanttRowGrip({
  palette,
  onGripDown,
}: {
  palette: PlanPalette;
  onGripDown: GanttRowReorderProps['onGripDown'];
}) {
  return (
    <Tooltip label="Drag to Reorder">
      <span
        role="img"
        aria-label="Drag to Reorder"
        data-gantt-row-grip
        className="absolute left-0.5 top-1/2 z-10 flex h-5 w-2.5 -translate-y-1/2 cursor-grab touch-none items-center justify-center rounded opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100 active:cursor-grabbing motion-reduce:transition-none"
        style={{ color: palette.muted }}
        onPointerDown={(e) =>
          onGripDown((e.currentTarget as HTMLElement).closest<HTMLElement>('[data-gantt-row]'))(e)
        }
        onClick={stop}
        onDoubleClick={stop}
      >
        <svg width="6" height="10" viewBox="0 0 6 10" aria-hidden fill="currentColor">
          {[1, 5, 9].map((y) => (
            <g key={y}>
              <circle cx="1" cy={y} r="1" />
              <circle cx="5" cy={y} r="1" />
            </g>
          ))}
        </svg>
      </span>
    </Tooltip>
  );
}

// A swimlane's header in the names column: a chevron, the lane's avatar, glyph or colour dot, its name and its
// count of projects. It collapses the lane for this person alone.
export function GanttLaneHead({
  lane,
  count,
  collapsed,
  types = ITEM_TYPES,
  palette,
  top,
  height,
  onToggle,
}: {
  lane: LaneHead;
  count: number;
  collapsed: boolean;
  types?: readonly ItemTypeDef[];
  palette: PlanPalette;
  top: number;
  height: number;
  onToggle: () => void;
}) {
  const type = lane.field === 'type' ? types.find((t) => t.id === lane.value) : undefined;
  return (
    <button
      type="button"
      className="absolute inset-x-0 flex min-w-0 cursor-pointer items-center gap-1.5 px-2 text-left text-[11px] font-semibold"
      style={{ top, height, color: palette.muted, backgroundColor: palette.column }}
      aria-expanded={!collapsed}
      aria-label={`${lane.label}, ${count} ${count === 1 ? 'project' : 'projects'}`}
      onPointerDown={stop}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span aria-hidden>{collapsed ? '▸' : '▾'}</span>
      {lane.person ? <PersonDisc person={lane.person} /> : null}
      {type ? <PlanTypeGlyph glyph={type.glyph} size={12} color={type.color} /> : null}
      {lane.colour ? <ColourDot colour={lane.colour} /> : null}
      <span className="min-w-0 truncate" style={{ color: palette.text }}>
        {lane.label}
      </span>
      <span className="shrink-0 tabular-nums font-medium">{count}</span>
    </button>
  );
}
