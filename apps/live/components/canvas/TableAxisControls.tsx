import { createPortal } from 'react-dom';
import type { TableElement } from '@livediagram/diagram';
import { TableHeaderMenu, Trigger } from '@/components/canvas/table-menu-controls';

// The table's outside-the-edge column / row controls (spec/09 Table): the
// ⋯ trigger strips laid out on grids mirroring the live track templates
// (so each trigger stays centred over its column / in its row at any
// pinned width), and the portalled insert / move / delete menu the
// triggers open. Extracted from TableView as one cohesive slice — the
// hover state stays in TableView because the grid CELLS also arm it (the
// trigger appears when hovering anywhere in the column / row).

type AxisMenu = { axis: 'col' | 'row'; index: number; x: number; y: number } | null;

// Centre of track `i` along its axis, in element-space px.
function trackCentre(sizes: number[], i: number): number {
  let off = 0;
  for (let k = 0; k < i; k++) off += sizes[k]!;
  return off + (sizes[i] ?? 0) / 2;
}

// The table's quick-connect pluses sit on the edge MIDPOINTS (spec/09),
// right where a centre column / row's ⋯ trigger would land now the
// triggers live outside the edges. When a trigger's centre falls under
// the plus, dodge it sideways / downwards by a screen-constant nudge.
// Clearance in screen px, converted to element space (the plus is a fixed
// screen size; the trigger counter-scales too).
const PLUS_CLEARANCE_PX = 40;

export function TableAxisTriggers({
  cols,
  rows,
  colTemplate,
  rowTemplate,
  colSizes,
  rowSizes,
  elementWidth,
  elementHeight,
  invScale,
  isMobile,
  hoveredCol,
  hoveredRow,
  onHoverCol,
  onHoverRow,
  onHoverLeave,
  menu,
  onToggle,
}: {
  cols: number;
  rows: number;
  colTemplate: string;
  rowTemplate: string;
  colSizes: number[];
  rowSizes: number[];
  elementWidth: number;
  elementHeight: number;
  invScale: number;
  // Touch has no hover, so the triggers stay visible there.
  isMobile: boolean;
  hoveredCol: number | null;
  hoveredRow: number | null;
  // Keep the trigger mounted while the pointer crosses the gap from the
  // cells to it (TableView's hover-grace timers).
  onHoverCol: (c: number) => void;
  onHoverRow: (r: number) => void;
  onHoverLeave: () => void;
  menu: AxisMenu;
  onToggle: (axis: 'col' | 'row', index: number, e: React.MouseEvent) => void;
}) {
  const dodges = (centre: number, mid: number) =>
    Math.abs(centre - mid) < PLUS_CLEARANCE_PX * invScale;
  return (
    <>
      {/* Column triggers laid out on a grid mirroring the column
          template so each stays centred over its column at any width
          (including while a column is being resized). They sit OUTSIDE
          the table's top edge so they never crowd the first row's
          content. */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-7 grid"
        style={{ gridTemplateColumns: colTemplate }}
      >
        {Array.from({ length: cols }, (_, c) => {
          const colOn = isMobile || hoveredCol === c || (menu?.axis === 'col' && menu.index === c);
          return (
            <div key={`col-${c}`} className="flex min-w-0 justify-center">
              {colOn ? (
                <div
                  className="pointer-events-auto relative"
                  style={{
                    transform: `${
                      dodges(trackCentre(colSizes, c), elementWidth / 2)
                        ? `translateX(${34 * invScale}px) `
                        : ''
                    }scale(${invScale})`,
                    transformOrigin: 'bottom center',
                  }}
                  onMouseEnter={() => onHoverCol(c)}
                  onMouseLeave={onHoverLeave}
                >
                  <Trigger
                    open={menu?.axis === 'col' && menu.index === c}
                    onClick={(e) => onToggle('col', c, e)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Row triggers on a grid mirroring the row template (like the
          column triggers above) so each stays centred in its row when
          heights are pinned to non-uniform values. They sit OUTSIDE the
          table's left edge so they never crowd the first column. */}
      <div
        className="pointer-events-none absolute inset-y-0 -left-7 grid"
        style={{ gridTemplateRows: rowTemplate }}
      >
        {Array.from({ length: rows }, (_, r) => {
          const rowOn = isMobile || hoveredRow === r || (menu?.axis === 'row' && menu.index === r);
          return (
            <div key={`row-${r}`} className="flex min-h-0 items-center">
              {rowOn ? (
                <div
                  className="pointer-events-auto relative"
                  style={{
                    transform: `${
                      dodges(trackCentre(rowSizes, r), elementHeight / 2)
                        ? `translateY(${34 * invScale}px) `
                        : ''
                    }scale(${invScale})`,
                    transformOrigin: 'center right',
                  }}
                  onMouseEnter={() => onHoverRow(r)}
                  onMouseLeave={onHoverLeave}
                >
                  <Trigger
                    vertical
                    open={menu?.axis === 'row' && menu.index === r}
                    onClick={(e) => onToggle('row', r, e)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

// The open column / row menu, portalled to <body>: rendered inline it
// sat inside the canvas transform's stacking context, where later
// siblings (other elements, floating chrome) could paint over it.
export function TableAxisMenuPortal({
  menu,
  cols,
  rows,
  addCol,
  moveCol,
  delCol,
  addRow,
  moveRow,
  delRow,
}: {
  menu: NonNullable<AxisMenu>;
  cols: number;
  rows: number;
  addCol: (index: number) => void;
  moveCol: (index: number, delta: number) => void;
  delCol: (index: number) => void;
  addRow: (index: number) => void;
  moveRow: (index: number, delta: number) => void;
  delRow: (index: number) => void;
}) {
  return createPortal(
    <div
      data-table-ui
      className={`pointer-events-auto fixed z-[var(--z-overlay)] w-36 animate-pop-in rounded-lg border border-slate-200 bg-white/90 p-1 shadow-lg backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/90 ${
        menu.axis === 'col' ? '-translate-x-1/2' : '-translate-y-1/2'
      }`}
      style={{ left: menu.x, top: menu.y }}
    >
      {menu.axis === 'col' ? (
        <TableHeaderMenu
          axis="col"
          index={menu.index}
          count={cols}
          onAdd={addCol}
          onMove={moveCol}
          onDelete={delCol}
        />
      ) : (
        <TableHeaderMenu
          axis="row"
          index={menu.index}
          count={rows}
          onAdd={addRow}
          onMove={moveRow}
          onDelete={delRow}
        />
      )}
    </div>,
    document.body,
  );
}

// The between-track resize divider strips (spec/09 Table): thin strips
// riding grids that mirror the live column / row templates so each
// divider sits exactly on its boundary. A divider must REST (arm) under
// the pointer before a press starts a resize — an instant strip on
// every border swallowed clicks mid-edit — and double-clicking an armed
// divider clears that track's pinned size back to auto.
export function TableResizeDividers({
  element,
  rows,
  cols,
  colTemplate,
  rowTemplate,
  armedResize,
  armResizeEnter,
  armResizeLeave,
  startColResize,
  startRowResize,
  onCommitTable,
}: {
  element: TableElement;
  rows: number;
  cols: number;
  colTemplate: string;
  rowTemplate: string;
  armedResize: { axis: 'col' | 'row'; index: number } | null;
  armResizeEnter: (axis: 'col' | 'row', index: number) => void;
  armResizeLeave: () => void;
  startColResize: (index: number) => (e: React.PointerEvent) => void;
  startRowResize: (index: number) => (e: React.PointerEvent) => void;
  onCommitTable: (
    id: string,
    patch: Partial<Pick<TableElement, 'colWidths' | 'rowHeights'>>,
  ) => void;
}) {
  return (
    <>
      {/* Column-resize dividers (between columns). */}
      <div
        className="pointer-events-none absolute inset-0 grid"
        style={{ gridTemplateColumns: colTemplate }}
      >
        {Array.from({ length: cols }, (_, c) => (
          <div key={`rz-${c}`} className="relative">
            {c < cols - 1 ? (
              <div
                onPointerEnter={() => armResizeEnter('col', c)}
                onPointerLeave={armResizeLeave}
                onPointerDown={(e) => {
                  // Only a rested (armed) divider starts a resize —
                  // an instant strip on every border swallowed clicks
                  // mid-edit.
                  if (armedResize?.axis === 'col' && armedResize.index === c) startColResize(c)(e);
                }}
                onDoubleClick={(e) => {
                  if (!(armedResize?.axis === 'col' && armedResize.index === c)) return;
                  e.stopPropagation();
                  onCommitTable(element.id, {
                    colWidths: Array.from({ length: cols }, (_, i) =>
                      i === c ? null : (element.colWidths?.[i] ?? null),
                    ),
                  });
                }}
                className={`pointer-events-auto absolute -right-1 bottom-0 top-0 z-[var(--z-toolbar)] w-2 ${
                  armedResize?.axis === 'col' && armedResize.index === c ? 'cursor-col-resize' : ''
                }`}
              >
                <div
                  className={`mx-auto h-full w-0.5 transition ${
                    armedResize?.axis === 'col' && armedResize.index === c
                      ? 'bg-brand-400'
                      : 'bg-brand-400/0'
                  }`}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Row-resize dividers (between rows). */}
      <div
        className="pointer-events-none absolute inset-0 grid"
        style={{ gridTemplateRows: rowTemplate }}
      >
        {Array.from({ length: rows }, (_, r) => (
          <div key={`rzr-${r}`} className="relative">
            {r < rows - 1 ? (
              <div
                onPointerEnter={() => armResizeEnter('row', r)}
                onPointerLeave={armResizeLeave}
                onPointerDown={(e) => {
                  if (armedResize?.axis === 'row' && armedResize.index === r) startRowResize(r)(e);
                }}
                onDoubleClick={(e) => {
                  if (!(armedResize?.axis === 'row' && armedResize.index === r)) return;
                  e.stopPropagation();
                  onCommitTable(element.id, {
                    rowHeights: Array.from({ length: rows }, (_, i) =>
                      i === r ? null : (element.rowHeights?.[i] ?? null),
                    ),
                  });
                }}
                className={`pointer-events-auto absolute -bottom-1 left-0 right-0 z-[var(--z-toolbar)] h-2 ${
                  armedResize?.axis === 'row' && armedResize.index === r ? 'cursor-row-resize' : ''
                }`}
              >
                <div
                  className={`my-auto h-0.5 w-full transition ${
                    armedResize?.axis === 'row' && armedResize.index === r
                      ? 'bg-brand-400'
                      : 'bg-brand-400/0'
                  }`}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </>
  );
}
