'use client';

// A collapsed column on a Plan board (docs/specs/026-plan/plan-board.md "Collapse Column"): a thin strip in its place.
// Its head (in the board's head row) is the column's colour bar over an Expand Column chevron; each of its cells (one,
// or one per open swimlane) shows the count there and the column's name written top to bottom, the whole cell a button
// that expands it. A cell is a drop target like an open column's (`data-plan-status`, `data-plan-lane`), lit while a
// card is held over it. The collapse chevron an open column's head shows is CollapseColumnButton, here too.
import type { PlanColumn } from '@liveplanner/items';
import { ChevronLeftIcon, ChevronRightIcon, CountBadge, Tooltip } from '@liveplanner/ui';
import { plural } from '@liveplanner/project';
import { COLUMN_ATTR, STRIP_ATTR } from './column-move-flip';
import type { PlanPalette } from './plan-palette';

// The strip's cell button lays the count and the name out as a column that wraps (docs/specs/026-plan/plan-board.md
// "Collapse Column"): each is a full-width line, so when the name is too long for the room left under the count, it
// is carried to a second line beside the first, out of the button's width and clipped, never half-drawn as "U...".
// The browser decides this in layout, with no measuring in script, so there is no flash of a clipped name either.
export const STRIP_BUTTON_CLASS =
  'absolute inset-0 flex cursor-pointer flex-col flex-wrap content-start items-center gap-2 overflow-hidden rounded-b-lg pb-2 pt-1 transition hover:bg-black/[0.03] motion-reduce:transition-none dark:hover:bg-white/[0.04]';
export const STRIP_LINE_CLASS = 'flex w-full shrink-0 justify-center';
export const STRIP_NAME_CLASS =
  'whitespace-nowrap text-[13px] font-semibold [writing-mode:vertical-rl]';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The red a refused drop is drawn in (PlanBoardCells' DropGap).
const REFUSED_COLOUR = '#dc2626';

// The attribute the collapse and expand chevrons carry, set to the column's id, so focus can follow a toggle.
export const COLUMN_TOGGLE_ATTR = 'data-column-toggle';

const CHEVRON =
  'touch-target relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition hover:bg-black/5 motion-reduce:transition-none dark:hover:bg-white/10';

// Collapse Column on an open column's head: always shown, so it is found without hovering and the head keeps no gap;
// at rest it sits a little quieter than the cog beside it, and rises to full strength on hover and focus.
export function CollapseColumnButton({
  column,
  palette,
  onCollapse,
}: {
  column: Pick<PlanColumn, 'id' | 'name'>;
  palette: PlanPalette;
  onCollapse: () => void;
}) {
  return (
    <Tooltip label="Collapse Column">
      <button
        type="button"
        {...{ [COLUMN_TOGGLE_ATTR]: column.id }}
        aria-label={`Collapse Column, ${column.name}`}
        aria-expanded
        className={`${CHEVRON} -mr-1 opacity-70 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100`}
        style={{ color: palette.muted }}
        onPointerDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          onCollapse();
        }}
      >
        <ChevronLeftIcon size={14} />
      </button>
    </Tooltip>
  );
}

// The strip's head: the colour bar, then Expand Column.
export function CollapsedColumnHead({
  column,
  palette,
  onExpand,
}: {
  column: Pick<PlanColumn, 'id' | 'name' | 'color'>;
  palette: PlanPalette;
  onExpand: () => void;
}) {
  return (
    <div
      {...{ [COLUMN_ATTR]: column.id, [STRIP_ATTR]: '' }}
      className="sticky top-0 z-[1] flex flex-col items-center rounded-t-lg px-1.5 pb-1.5 pt-2"
      style={{ backgroundColor: palette.column }}
    >
      <div
        className="mb-1.5 h-1 w-full rounded-full"
        style={{ backgroundColor: column.color ?? palette.border }}
        aria-hidden
      />
      <Tooltip label="Expand Column">
        <button
          type="button"
          {...{ [COLUMN_TOGGLE_ATTR]: column.id }}
          aria-label={`Expand Column, ${column.name}`}
          aria-expanded={false}
          className={CHEVRON}
          style={{ color: palette.muted }}
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <ChevronRightIcon size={14} />
        </button>
      </Tooltip>
    </div>
  );
}

// One cell of the strip: the count there and the name, top to bottom; a drop target, lit while a card is held over
// it (`held`: in the focus colour, or red when the card's type leaves the status out).
export function CollapsedColumnCell({
  column,
  status,
  laneKey,
  laneLabel,
  count,
  limit,
  overLimit,
  palette,
  held,
  onExpand,
}: {
  column: Pick<PlanColumn, 'id' | 'name'>;
  status: string;
  laneKey: string;
  // The swimlane's name, on a board with swimlanes.
  laneLabel?: string | undefined;
  count: number;
  // The column's WIP limit, said with its count (not a swimlane's part, whose count is the row's).
  limit?: number | undefined;
  overLimit: boolean;
  palette: PlanPalette;
  held: 'over' | 'refused' | null;
  onExpand: () => void;
}) {
  const ring = held === 'refused' ? REFUSED_COLOUR : held === 'over' ? palette.focus : undefined;
  const counted = limit
    ? `${count} of a WIP limit of ${limit}${overLimit ? ', over the limit' : ''}`
    : plural(count, 'item');
  return (
    <div
      {...{ [COLUMN_ATTR]: column.id, [STRIP_ATTR]: '' }}
      data-plan-status={status}
      data-plan-lane={laneKey}
      className="relative min-h-16 rounded-b-lg transition-[outline-color,background-color] motion-reduce:transition-none"
      style={{
        backgroundColor: ring
          ? `color-mix(in srgb, ${ring} 10%, ${palette.column})`
          : palette.column,
        outline: ring ? `2px dashed ${ring}` : 'none',
        outlineOffset: -2,
      }}
    >
      <Tooltip label={`Expand Column, ${column.name}`}>
        <button
          type="button"
          aria-label={`Expand Column, ${column.name}${laneLabel ? `, ${laneLabel}` : ''}, ${counted}`}
          aria-expanded={false}
          className={STRIP_BUTTON_CLASS}
          onPointerDown={stop}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <span className={STRIP_LINE_CLASS}>
            <CountBadge
              size="md"
              background={overLimit ? palette.warningBg : palette.surface}
              color={overLimit ? palette.warning : palette.muted}
            >
              {count}
            </CountBadge>
          </span>
          <span className={STRIP_LINE_CLASS}>
            <span className={STRIP_NAME_CLASS} style={{ color: palette.text }}>
              {column.name}
            </span>
          </span>
        </button>
      </Tooltip>
    </div>
  );
}
