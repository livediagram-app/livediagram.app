'use client';

// A collapsed column on a Plan board (docs/specs/026-plan/plan-board.md "Collapse Column"): a thin strip in its place.
// Its head (in the board's head row) is the column's colour bar over an Expand Column chevron; each of its cells (one,
// or one per open swimlane) shows the column's name written top to bottom (once, with swimlanes), the whole cell a button
// that expands it. A cell is a drop target like an open column's (`data-plan-status`, `data-plan-lane`), lit while a
// card is held over it. The collapse chevron an open column's head shows is CollapseColumnButton, here too.
import type { PlanColumn } from '@liveplanner/items';
import { Tooltip } from '@liveplanner/ui';
import { plural } from '@liveplanner/project';
import { COLUMN_ATTR, STRIP_ATTR } from './column-move-flip';
import type { PlanPalette } from './plan-palette';
import { columnHeadStyle, columnPartStyle } from './column-part';
import { PLAN_HEADING_STYLE } from '@/lib/plan-font';

// The strip's cell button lays the name out as a column that wraps (docs/specs/026-plan/plan-board.md "Collapse
// Column"): a full-width line, so when the name is too long for the cell, it is carried to a second line beside the
// first, out of the button's width and clipped, never half-drawn as "U...".
// The browser decides this in layout, with no measuring in script, so there is no flash of a clipped name either.
export const STRIP_BUTTON_CLASS =
  'absolute inset-0 flex cursor-pointer flex-col flex-wrap content-start items-center gap-2 overflow-hidden rounded-[inherit] pb-3 pt-2.5 transition hover:bg-black/[0.03] motion-reduce:transition-none dark:hover:bg-white/[0.04]';
export const STRIP_LINE_CLASS = 'flex w-full shrink-0 justify-center';
export const STRIP_NAME_CLASS =
  'whitespace-nowrap text-[13px] font-semibold [writing-mode:vertical-rl]';

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// The collapse and expand glyphs (docs/specs/026-plan/plan-board.md "Collapse Column"): a column's edge with two arrows
// closing on it (collapse), or opening out from it (expand), so the button says what the column will do.
const GLYPH = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};
function CollapseColumnGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M12 4v16" />
      <path d="M3 12h6M6.5 9.5 9 12l-2.5 2.5" />
      <path d="M21 12h-6M17.5 9.5 15 12l2.5 2.5" />
    </svg>
  );
}
function ExpandColumnGlyph() {
  return (
    <svg {...GLYPH}>
      <path d="M12 5v14" />
      <path d="M9 12H3M5.5 9.5 3 12l2.5 2.5" />
      <path d="M15 12h6M18.5 9.5 21 12l-2.5 2.5" />
    </svg>
  );
}

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
        <CollapseColumnGlyph />
      </button>
    </Tooltip>
  );
}

// The strip's head: the colour bar, then Expand Column.
export function CollapsedColumnHead({
  column,
  palette,
  onExpand,
  bar,
}: {
  column: Pick<PlanColumn, 'id' | 'name' | 'color'>;
  palette: PlanPalette;
  onExpand: () => void;
  // Its top bar's colour when the column has none of its own (a multi-colour theme's, column-tones.ts).
  bar?: string | undefined;
}) {
  return (
    <div
      {...{ [COLUMN_ATTR]: column.id, [STRIP_ATTR]: '' }}
      className="plan-col sticky top-0 z-[1] flex flex-col items-center rounded-[var(--plan-col-r,8px)] px-1.5 pb-1.5 pt-2"
      style={columnHeadStyle(palette)}
    >
      <div
        className="mb-1.5 h-1 w-full rounded-full"
        style={{ backgroundColor: column.color ?? bar ?? palette.border }}
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
          <ExpandColumnGlyph />
        </button>
      </Tooltip>
    </div>
  );
}

// One cell of the strip: the column's name, top to bottom (its count only in its accessible name); a drop target, lit while a card is held over
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
  named = true,
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
  // Its name: with swimlanes only the first open row's part says it, so the name shows once.
  named?: boolean;
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
      className="plan-col relative min-h-16 rounded-[var(--plan-col-r,8px)] transition-[outline-color,background-color] motion-reduce:transition-none"
      style={{
        ...columnPartStyle(palette),
        // A held card tints it; otherwise its colour is the part's own (plan-col).
        ...(ring ? { backgroundColor: `color-mix(in srgb, ${ring} 10%, ${palette.column})` } : {}),
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
          {named ? (
            <span className={STRIP_LINE_CLASS}>
              <span
                className={STRIP_NAME_CLASS}
                style={{ ...PLAN_HEADING_STYLE, color: palette.text }}
              >
                {column.name}
              </span>
            </span>
          ) : null}
        </button>
      </Tooltip>
    </div>
  );
}
