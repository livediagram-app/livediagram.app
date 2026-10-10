'use client';

// Column letters across the top and row numbers down the left (docs/specs/029-sheets/sheet.md "The grid", "Rows and
// columns"): tinted where the selection is, and a small double arrow between the neighbours of hidden lines that
// shows them again. Resizing and header menus are the pointer's (useSheetPointer).
import { columnLetters, type Selection } from '@livediagram/sheets';
import { Tooltip } from '@livediagram/ui';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { type Geometry, type GridWindow } from './sheet-geometry';

type Props = {
  geometry: Geometry;
  window: GridWindow;
  scroll: { top: number; left: number };
  palette: PlanPalette;
  // Null outside Plan mode: the selection is not shown there.
  selection: Selection | null;
  view: { width: number; height: number };
  // Show hidden lines again (null when the person may not).
  onUnhide: ((axis: 'r' | 'c', from: number, to: number) => void) | null;
};

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

// How a header shows the selection: 'line' when its whole row or column is selected (drawn solid), 'cells' when the
// selection only crosses it (tinted, with an edge in the focus colour, as a modern spreadsheet marks it), else none.
function selectedOn(
  sel: Selection | null,
  axis: 'r' | 'c',
  i: number,
  lines: { rows: number; cols: number },
): 'line' | 'cells' | null {
  if (!sel) return null;
  let crossed = false;
  for (const g of sel.ranges) {
    const inside = axis === 'r' ? i >= g.r1 && i <= g.r2 : i >= g.c1 && i <= g.c2;
    if (!inside) continue;
    crossed = true;
    const whole =
      axis === 'r' ? g.c1 === 0 && g.c2 >= lines.cols - 1 : g.r1 === 0 && g.r2 >= lines.rows - 1;
    if (whole) return 'line';
  }
  return crossed ? 'cells' : null;
}

// Runs of hidden lines, as [from, to] positions.
function hiddenRuns(n: number, hidden: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    if (i < n && hidden(i)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  }
  return out;
}

// The small double arrows between the neighbours of hidden lines. Drawn in the header band, or at the grid's own edge
// when the sheet hides its headers (so hidden lines can always come back).
function unhideMarkers({ geometry: g, scroll, palette, view, onUnhide }: Props): React.ReactNode[] {
  const markers: React.ReactNode[] = [];
  if (!onUnhide) return markers;
  const marker = (
    key: string,
    label: string,
    left: number,
    top: number,
    turned: boolean,
    run: () => void,
  ) => (
    <Tooltip key={key} label={label}>
      <button
        type="button"
        aria-label={label}
        className="absolute z-[7] flex h-4 w-4 cursor-pointer items-center justify-center rounded-sm text-[9px] leading-none"
        style={{
          left,
          top,
          backgroundColor: palette.surface,
          color: palette.text,
          border: `1px solid ${palette.border}`,
        }}
        onPointerDown={stop}
        onClick={run}
      >
        <span className={turned ? 'rotate-90' : undefined}>‹›</span>
      </button>
    </Tooltip>
  );
  for (const [a, b] of hiddenRuns(g.cols.length - 1, g.hiddenCol)) {
    const x = g.headW + (a < g.frozenCols ? g.cols[a]! : g.cols[a]! - scroll.left);
    if (x < g.headW - 4 || x > view.width) continue;
    const label = `Show Column${a === b ? '' : 's'} ${columnLetters(a)}${a === b ? '' : ` to ${columnLetters(b)}`}`;
    markers.push(marker(`hc${a}`, label, x - 8, 3, false, () => onUnhide('c', a, b)));
  }
  for (const [a, b] of hiddenRuns(g.rows.length - 1, g.hiddenRow)) {
    const y = g.headH + (a < g.frozenRows ? g.rows[a]! : g.rows[a]! - scroll.top);
    if (y < g.headH - 4 || y > view.height) continue;
    const label = `Show Row${a === b ? '' : 's'} ${a + 1}${a === b ? '' : ` to ${b + 1}`}`;
    markers.push(
      marker(`hr${a}`, label, g.headW ? g.headW - 18 : 3, y - 8, true, () => onUnhide('r', a, b)),
    );
  }
  return markers;
}

export function SheetHeaders(props: Props) {
  const { geometry: g, window: w, scroll, palette, selection, view } = props;
  const markers = unhideMarkers(props);
  // A sheet that hides its headers (Sheet Settings) draws none, only the way back for hidden lines.
  if (!g.headW && !g.headH) return <>{markers}</>;
  const head = {
    backgroundColor: palette.column,
    color: palette.muted,
    borderColor: palette.cardBorder,
  };
  const lines = { rows: g.rows.length - 1, cols: g.cols.length - 1 };
  const look = (state: 'line' | 'cells' | null, axis: 'r' | 'c'): React.CSSProperties =>
    state === 'line'
      ? { backgroundColor: palette.focus, color: '#ffffff', fontWeight: 600 }
      : state === 'cells'
        ? {
            backgroundColor: `color-mix(in srgb, ${palette.focus} 18%, ${palette.column})`,
            color: palette.focus,
            fontWeight: 600,
            boxShadow:
              axis === 'c' ? `inset 0 -2px 0 ${palette.focus}` : `inset -2px 0 0 ${palette.focus}`,
          }
        : {};
  const cols: React.ReactNode[] = [];
  const colIdx = [...Array.from({ length: g.frozenCols }, (_, i) => i), ...range(w.c1, w.c2)];
  for (const c of colIdx) {
    if (g.hiddenCol(c)) continue;
    const x = g.headW + (c < g.frozenCols ? g.cols[c]! : g.cols[c]! - scroll.left);
    const width = g.cols[c + 1]! - g.cols[c]!;
    if (c >= g.frozenCols && x + width < g.headW + g.frozenWidth) continue;
    const colState = selectedOn(selection, 'c', c, lines);
    cols.push(
      <div
        key={`c${c}`}
        data-selected={colState ?? undefined}
        role="columnheader"
        aria-colindex={c + 1}
        className="absolute flex select-none items-center justify-center border-b border-r text-[11px] transition-colors duration-75"
        style={{
          left: x,
          top: 0,
          width,
          height: g.headH,
          ...head,
          ...look(colState, 'c'),
          zIndex: c < g.frozenCols ? 6 : 5,
        }}
      >
        {columnLetters(c)}
      </div>,
    );
  }
  const rows: React.ReactNode[] = [];
  const rowIdx = [...Array.from({ length: g.frozenRows }, (_, i) => i), ...range(w.r1, w.r2)];
  for (const r of rowIdx) {
    if (g.hiddenRow(r)) continue;
    const y = g.headH + (r < g.frozenRows ? g.rows[r]! : g.rows[r]! - scroll.top);
    const height = g.rows[r + 1]! - g.rows[r]!;
    if (r >= g.frozenRows && y + height < g.headH + g.frozenHeight) continue;
    const rowState = selectedOn(selection, 'r', r, lines);
    rows.push(
      <div
        key={`r${r}`}
        data-selected={rowState ?? undefined}
        role="rowheader"
        aria-rowindex={r + 1}
        className="absolute flex select-none items-center justify-end border-b border-r pr-1.5 text-[11px] tabular-nums transition-colors duration-75"
        style={{
          left: 0,
          top: y,
          width: g.headW,
          height,
          ...head,
          ...look(rowState, 'r'),
          zIndex: r < g.frozenRows ? 6 : 5,
        }}
      >
        {r + 1}
      </div>,
    );
  }
  return (
    <>
      <div
        className="pointer-events-none absolute left-0 top-0 overflow-hidden"
        style={{ width: view.width, height: g.headH }}
      >
        {cols}
      </div>
      <div
        className="pointer-events-none absolute left-0 top-0 overflow-hidden"
        style={{ width: g.headW, height: view.height }}
      >
        {rows}
      </div>
      <div
        className="pointer-events-none absolute left-0 top-0 z-[8] border-b border-r"
        style={{ width: g.headW, height: g.headH, ...head }}
      />
      {markers}
    </>
  );
}

function range(a: number, b: number): number[] {
  const out: number[] = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
