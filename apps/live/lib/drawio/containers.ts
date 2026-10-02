// draw.io containers with a meaning of their own
// (docs/specs/020-import-export/blueprints/drawio-import.md step 11):
// swimlanes become lanes, class / entity stacks become entities, tables
// become tables. Entity rows and table rows / cells are consumed: the caller
// forwards their connections to the container.

import {
  ENTITY_MAX_FIELDS,
  ENTITY_MAX_TEXT,
  type EntityField,
  type ShapeElement,
  type TableCellStyle,
  type TableElement,
  type TextAlignX,
  type TextElement,
} from '@livediagram/document';
import { absoluteRect, type DrawioCell, type DrawioGraph, type Rect } from './cells';
import { hexFill, hexInk, readColour, readFill } from './colour';
import { cellLabel } from './label';
import { classifyVertex } from './shapes';
import { shapeName } from './style';
import { DRAWIO_CAPTION_CHAR_PX } from './limits';
import { boxedProps, inkOnFill, textProps } from './vertex-props';
import type { PageContext } from './vertices';

const TITLE = { scale: 'label', rich: false, outsideMovesIn: false } as const;

// A title reading across needs about this much room per character (bold, at
// the `sm` label size draw.io's 12 px maps to), plus the label's padding either
// side and a little air.
const TITLE_CHAR_PX = DRAWIO_CAPTION_CHAR_PX + 2;
const TITLE_PADDING_PX = 16;

/** The width a lane title needs to read across on one line. */
export function laneTitleWidth(title: string): number {
  const longest = Math.max(...title.split('\n').map((line) => line.length));
  return longest * TITLE_CHAR_PX + TITLE_PADDING_PX;
}

const isVerticalLane = (cell: DrawioCell, graph: DrawioGraph) =>
  cell.vertex &&
  cell.visible &&
  cell.style.str('horizontal') === '0' &&
  classifyVertex(cell, graph).kind === 'lane';

const titleOf = (cell: DrawioCell) => cellLabel(cell).plain.trim();

export type LaneLayout = {
  /** How far the lane grows to the left; its right edge stays. */
  growth: number;
  /** Its title strip's width. */
  gutter: number;
};

// One lane on its own: the strip its title wants, and the room before its first
// child (children measured at their own grown left edges).
type LaneNeed = { gutter: number; room: number };
type LaneMemo = { own: Map<string, LaneNeed>; stacked: Map<string, LaneLayout> };
const memos = new WeakMap<DrawioGraph, LaneMemo>();
const memoOf = (graph: DrawioGraph) => {
  let memo = memos.get(graph);
  if (!memo) {
    memo = { own: new Map(), stacked: new Map() };
    memos.set(graph, memo);
  }
  return memo;
};
const NONE: LaneLayout = { growth: 0, gutter: 0 };
const NO_NEED: LaneNeed = { gutter: 0, room: Infinity };

function ownNeed(graph: DrawioGraph, id: string): LaneNeed {
  const memo = memoOf(graph).own;
  const known = memo.get(id);
  if (known) return known;
  memo.set(id, NO_NEED); // a parent cycle resolves to no growth
  const cell = graph.cells.get(id);
  const rect = absoluteRect(graph, id);
  if (!cell || !rect || !isVerticalLane(cell, graph)) return NO_NEED;
  const startSize = cell.style.num('startSize') ?? 23;
  const title = titleOf(cell);
  const gutter = title ? Math.max(startSize, laneTitleWidth(title)) : startSize;
  const lefts = cell.children
    .map((childId) => graph.cells.get(childId))
    .filter((c): c is DrawioCell => !!c && c.vertex && c.visible)
    .flatMap((c) => {
      const r = absoluteRect(graph, c.id);
      return r ? [r.x - laneLayout(graph, c.id).growth - rect.x] : [];
    });
  const room = lefts.length > 0 ? Math.min(...lefts) : Infinity;
  const out = { gutter, room };
  memo.set(id, out);
  return out;
}

/**
 * How a vertical lane carries over (docs/specs/020-import-export/drawio-import.md
 * "Vertical lane titles"). draw.io writes a `horizontal=0` lane's title upright
 * in a thin strip; livediagram cannot turn a lane title, so the strip widens
 * to hold the title on one line, and the lane grows LEFTWARDS by whatever the
 * gap before its content cannot give: the content stays exactly where it was.
 * Lanes stacked in a pool (siblings sharing a left edge and width) grow and
 * widen together, so the stack stays aligned. Nested lanes resolve bottom-up:
 * a pool makes room for its lanes' grown strips, then for its own title.
 */
export function laneLayout(graph: DrawioGraph, id: string): LaneLayout {
  const memo = memoOf(graph).stacked;
  const known = memo.get(id);
  if (known) return known;
  const cell = graph.cells.get(id);
  const rect = absoluteRect(graph, id);
  if (!cell || !rect || !isVerticalLane(cell, graph)) return NONE;
  const parent = cell.parentId ? graph.cells.get(cell.parentId) : undefined;
  const stack = (parent?.children ?? [id]).filter((siblingId) => {
    const sibling = graph.cells.get(siblingId);
    const r = absoluteRect(graph, siblingId);
    return (
      !!sibling &&
      !!r &&
      isVerticalLane(sibling, graph) &&
      Math.abs(r.x - rect.x) <= 1 &&
      Math.abs(r.width - rect.width) <= 1
    );
  });
  // One strip width for the stack, and the growth its tightest lane needs for it.
  const needs = stack.map((siblingId) => ownNeed(graph, siblingId));
  const gutter = Math.max(0, ...needs.map((n) => n.gutter));
  const growth = Math.max(0, ...needs.map((n) => gutter - n.room));
  const out = { growth, gutter };
  for (const siblingId of stack) memo.set(siblingId, out);
  return out;
}

export function buildLane(
  cell: DrawioCell,
  rect: Rect,
  graph: DrawioGraph,
  ctx: PageContext,
  id: string,
): ShapeElement {
  const s = cell.style;
  const horizontal = s.str('horizontal') !== '0';
  const { fillColor: _header, ...props } = boxedProps(cell, ctx);
  void _header;
  const header = hexFill(s.str('fillColor'));
  const body = readFill(s.str('swimlaneFillColor'));
  // A paper body takes the theme's surface; no body at all lets the page show through.
  const paperBody = body.kind === 'unset' && readColour(s.str('swimlaneFillColor')).kind === 'hex';
  const text = textProps(cell, ctx, { ...TITLE, onFill: header });
  const startSize = s.num('startSize') ?? 23;
  let box = rect;
  let headerSize = startSize;
  if (!horizontal) {
    if (text.label) ctx.tally.add('lane-title-turned');
    const { growth, gutter } = laneLayout(graph, cell.id);
    box = { ...rect, x: rect.x - growth, width: rect.width + growth };
    headerSize = Math.min(Math.max(startSize, gutter), box.width);
  }
  return {
    id,
    type: 'shape',
    shape: 'lane',
    ...box,
    ...props,
    ...(paperBody ? {} : { fillColor: body.kind === 'hex' ? body.value : 'transparent' }),
    ...(header ? { headerFill: header } : {}),
    headerSize,
    ...text,
    textAlignX: horizontal ? 'center' : 'left',
    textAlignY: horizontal ? 'top' : 'middle',
  };
}

const cut = (text: string, ctx: PageContext) => {
  if (text.length <= ENTITY_MAX_TEXT) return text;
  ctx.tally.add('text-truncated');
  return text.slice(0, ENTITY_MAX_TEXT);
};

function fieldOf(row: DrawioCell, ctx: PageContext): EntityField {
  const text = cellLabel(row).plain.replace(/\n/g, ' ').trim();
  const colon = text.lastIndexOf(':');
  const name = colon < 0 ? text : text.slice(0, colon).trim();
  const type = colon < 0 ? '' : text.slice(colon + 1).trim();
  return { name: cut(name, ctx), ...(type ? { type: cut(type, ctx) } : {}) };
}

export function buildEntity(
  cell: DrawioCell,
  rect: Rect,
  graph: DrawioGraph,
  ctx: PageContext,
  id: string,
): ShapeElement {
  const rows = cell.children
    .map((childId) => graph.cells.get(childId)!)
    .filter((row) => row.visible && shapeName(row.style) !== 'line');
  const fields = rows.slice(0, ENTITY_MAX_FIELDS).map((row) => fieldOf(row, ctx));
  ctx.tally.add('text-truncated', rows.length - fields.length);
  const props = boxedProps(cell, ctx);
  return {
    id,
    type: 'shape',
    shape: 'entity',
    ...rect,
    ...props,
    ...textProps(cell, ctx, { ...TITLE, onFill: props.fillColor }),
    entityFields: fields,
  };
}

const ALIGN_X: Record<string, TextAlignX> = { left: 'left', center: 'center', right: 'right' };

function cellStyleOf(c: DrawioCell): TableCellStyle | null {
  const s = c.style;
  const fontStyle = s.num('fontStyle') ?? 0;
  const bg = hexFill(s.str('fillColor'));
  const color = hexInk(s.str('fontColor')) ?? inkOnFill(bg);
  const alignX = ALIGN_X[s.str('align') ?? 'center'];
  const style: TableCellStyle = {
    ...(bg ? { bg } : {}),
    ...(color ? { textColor: color } : {}),
    ...(fontStyle & 1 ? { bold: true } : {}),
    ...(fontStyle & 2 ? { italic: true } : {}),
    ...(fontStyle & 4 ? { underline: true } : {}),
    ...(alignX && alignX !== 'center' ? { alignX } : {}),
  };
  return Object.keys(style).length > 0 ? style : null;
}

export type BuiltTable = { title: TextElement | null; table: TableElement | ShapeElement };

export function buildTable(
  cell: DrawioCell,
  rect: Rect,
  graph: DrawioGraph,
  ctx: PageContext,
  ids: { table: string; title: string },
): BuiltTable {
  const rows = cell.children
    .map((childId) => graph.cells.get(childId)!)
    .filter((row) => row.vertex && shapeName(row.style) === 'tableRow');
  const title = cellLabel(cell).plain;
  const startSize = Math.min(cell.style.num('startSize') ?? 0, rect.height - 1);
  const props = boxedProps(cell, ctx);

  if (rows.length === 0) {
    ctx.tally.add('shape-approximated');
    return {
      title: null,
      table: {
        id: ids.table,
        type: 'shape',
        shape: 'square',
        ...rect,
        ...props,
        ...textProps(cell, ctx, TITLE),
      },
    };
  }

  const cellsOf = (row: DrawioCell) =>
    row.children.map((id) => graph.cells.get(id)!).filter((c) => c.vertex);
  const width = Math.max(...rows.map((row) => cellsOf(row).length), 1);
  const grid = rows.map((row) => {
    const cs = cellsOf(row);
    return Array.from({ length: width }, (_, i) => cs[i]);
  });
  const cells = grid.map((row) => row.map((c) => (c ? cellLabel(c).plain : '')));
  const cellStyles = grid.map((row) => row.map((c) => (c ? cellStyleOf(c) : null)));
  const anyStyle = cellStyles.some((row) => row.some((s) => s !== null));
  const firstRowCells = grid[0]!;
  const colWidths = firstRowCells.map((c) =>
    c ? (absoluteRect(graph, c.id)?.width ?? null) : null,
  );
  const rowHeights = rows.map((row) => absoluteRect(graph, row.id)?.height ?? null);

  let titleEl: TextElement | null = null;
  if (title !== '' && startSize > 0) {
    ctx.tally.add('shape-approximated');
    const text = textProps(cell, ctx, TITLE);
    titleEl = {
      id: ids.title,
      type: 'text',
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: startSize,
      ...text,
      textAlignY: 'middle',
    };
  }

  const text = textProps(cell, ctx, TITLE);
  return {
    title: titleEl,
    table: {
      id: ids.table,
      type: 'table',
      x: rect.x,
      y: rect.y + startSize,
      width: rect.width,
      height: rect.height - startSize,
      cells,
      ...(anyStyle ? { cellStyles } : {}),
      colWidths,
      rowHeights,
      ...(props.fillColor ? { fillColor: props.fillColor } : {}),
      ...(props.strokeColor ? { strokeColor: props.strokeColor } : {}),
      strokeWidth: props.strokeWidth,
      ...(props.opacity !== undefined ? { opacity: props.opacity } : {}),
      ...(props.locked ? { locked: true } : {}),
      ...(props.link ? { link: props.link } : {}),
      ...(props.note ? { note: props.note } : {}),
      textSize: text.textSize,
      ...(text.font ? { font: text.font } : {}),
      ...(text.textColor
        ? { textColor: text.textColor }
        : inkOnFill(props.fillColor)
          ? { textColor: inkOnFill(props.fillColor) }
          : {}),
    },
  };
}
