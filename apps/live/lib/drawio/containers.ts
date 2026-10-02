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
import { shapeName } from './style';
import { boxedProps, inkOnFill, textProps } from './vertex-props';
import type { PageContext } from './vertices';

const TITLE = { scale: 'label', rich: false, outsideMovesIn: false } as const;

export function buildLane(
  cell: DrawioCell,
  rect: Rect,
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
  const headerSize = s.num('startSize') ?? 23;
  return {
    id,
    type: 'shape',
    shape: 'lane',
    ...rect,
    ...props,
    // draw.io draws a swimlane square-cornered; stacked lanes stay flush.
    borderRadius: 'none',
    ...(paperBody ? {} : { fillColor: body.kind === 'hex' ? body.value : 'transparent' }),
    ...(header ? { headerFill: header } : {}),
    headerSize,
    ...text,
    textAlignX: horizontal ? 'center' : 'left',
    textAlignY: horizontal ? 'top' : 'middle',
    // A horizontal=0 lane writes its title upright in its strip, as draw.io does.
    ...(horizontal ? {} : { titleOrientation: 'upright' as const }),
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
