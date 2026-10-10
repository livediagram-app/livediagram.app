import type { ReactElement } from 'react';
import type { TemplateKind } from '@livediagram/templates';
import { pv } from './motion';

// Group 16: the spreadsheet templates (docs/specs/026-plan/plan-templates.md "Spreadsheet templates"), drawn as the
// Sheet the editor draws: column letters over a header row on its tint, row numbers down the left, and cells of grey
// text. A sheet that fills its tab fills the tile; the Task Tracker sits on the canvas beside its sticky. Each hover
// story fills a cell the way the sheet is used. Static SVG preview tiles; TemplatePreview chains the groups with ??.

const FRAME = 'rgb(203 213 225)';
const GRID = 'rgb(226 232 240)';
const RULER = 'rgb(241 245 249)';
const HEAD_TINT = 'rgb(224 242 254)';
const HEAD_INK = 'rgb(12 74 110)';
const INK = 'rgb(148 163 184)';
const BOLD = 'rgb(71 85 105)';
const GREEN = 'rgb(22 163 74)';
const RED = 'rgb(220 38 38)';
const BLUE = 'rgb(37 99 235)';
const AMBER = 'rgb(217 119 6)';
const STICKY = 'rgb(254 240 138)';

// A cell's content: a grey line `w` of the cell wide (0 to 1), a colour, bold, right-aligned (a number).
type Cell = { w: number; ink?: string; bold?: boolean; right?: boolean; story?: number } | null;

// The grid at (x, y), `w` wide: a ruler of column letters, then the header row, then the rows; the last row a total
// when `total`. Columns share the width by `cols` weights.
function Grid({
  x,
  y,
  w,
  cols,
  rows,
  rowH = 4.2,
}: {
  x: number;
  y: number;
  w: number;
  cols: number[];
  rows: Cell[][];
  rowH?: number;
}) {
  const gutter = 3.4;
  const ruler = 2.6;
  const sum = cols.reduce((a, b) => a + b, 0);
  const widths = cols.map((c) => ((w - gutter) * c) / sum);
  const lefts = widths.map((_, i) => x + gutter + widths.slice(0, i).reduce((a, b) => a + b, 0));
  const top = y + ruler;
  const h = ruler + rows.length * rowH;
  return (
    <g>
      <rect x={x} y={y} width={w} height={ruler} fill={RULER} />
      <rect x={x} y={y} width={gutter} height={h} fill={RULER} />
      <rect x={x + gutter} y={top} width={w - gutter} height={rowH} fill={HEAD_TINT} />
      {rows.map((_, r) => (
        <rect key={`h${r}`} x={x} y={top + (r + 1) * rowH} width={w} height="0.3" fill={GRID} />
      ))}
      {lefts.map((lx, c) => (
        <rect key={`v${c}`} x={lx} y={y} width="0.3" height={h} fill={GRID} />
      ))}
      {rows.map((row, r) =>
        row.map((cell, c) => {
          if (!cell) return null;
          const cw = widths[c]!;
          const lw = Math.max(1.5, (cw - 2) * cell.w);
          const cx = cell.right ? lefts[c]! + cw - 1 - lw : lefts[c]! + 1;
          const ink = r === 0 ? HEAD_INK : (cell.ink ?? (cell.bold ? BOLD : INK));
          return (
            <rect
              key={`${r}-${c}`}
              className={cell.story !== undefined ? 'pv-new' : undefined}
              opacity={cell.story !== undefined ? 0 : undefined}
              style={cell.story !== undefined ? pv({ '--pv-at': `${cell.story}ms` }) : undefined}
              x={cx}
              y={top + r * rowH + rowH / 2 - (r === 0 || cell.bold ? 0.7 : 0.55)}
              width={lw}
              height={r === 0 || cell.bold ? 1.4 : 1.1}
              rx="0.5"
              fill={ink}
            />
          );
        }),
      )}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="0.8"
        fill="none"
        stroke={FRAME}
        strokeWidth="0.5"
      />
    </g>
  );
}

// A sheet filling the tile, as one filling its tab: the toolbar strip over the grid.
function filledSheet(cols: number[], rows: Cell[][], rowH?: number): ReactElement {
  return (
    <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
      <rect
        x="1"
        y="1"
        width="78"
        height="48"
        rx="3"
        fill="white"
        stroke={FRAME}
        strokeWidth="0.8"
      />
      <rect x="4" y="3.6" width="16" height="2.2" rx="1" fill="rgb(51 65 85)" />
      <rect x="4" y="7.4" width="72" height="2.6" rx="1" fill={RULER} />
      <Grid x={4} y={12} w={72} cols={cols} rows={rows} {...(rowH ? { rowH } : {})} />
    </svg>
  );
}

const head = (n: number): Cell[] => Array.from({ length: n }, () => ({ w: 0.7 }));
const num = (w: number, extra: Omit<NonNullable<Cell>, 'w'> = {}): Cell => ({
  w,
  right: true,
  ...extra,
});

export function templatePreviewGroup16(kind: TemplateKind): ReactElement | null {
  switch (kind) {
    case 'budget-planner':
      // Planned, Actual and the Difference, green under and red over; the story totals it.
      return filledSheet(
        [1.1, 1.4, 1, 1, 1],
        [
          head(5),
          [{ w: 0.6 }, { w: 0.5 }, num(0.5), num(0.5), num(0.2, { ink: GREEN })],
          [{ w: 0.6 }, { w: 0.7 }, num(0.4), num(0.4), num(0.3, { ink: GREEN })],
          [{ w: 0.5 }, { w: 0.8 }, num(0.4), num(0.4), num(0.3, { ink: RED })],
          [{ w: 0.6 }, { w: 0.6 }, num(0.4), num(0.35), num(0.3, { ink: GREEN })],
          [{ w: 0.7 }, { w: 0.9 }, num(0.4), num(0.35), num(0.3, { ink: GREEN })],
          [{ w: 0.6 }, { w: 0.6 }, num(0.4), num(0.4), num(0.2)],
          [
            { w: 0.5, bold: true },
            null,
            num(0.55, { bold: true, story: 700 }),
            num(0.55, { bold: true, story: 900 }),
            num(0.35, { bold: true, ink: GREEN, story: 1100 }),
          ],
        ],
      );
    case 'timesheet':
      // A week of hours; the story fills Friday's and the total.
      return filledSheet(
        [1, 1, 1.2, 1.4, 0.8],
        [
          head(5),
          [{ w: 0.7 }, num(0.6), { w: 0.6 }, { w: 0.5 }, num(0.4)],
          [{ w: 0.7 }, num(0.6), { w: 0.6 }, { w: 0.4 }, num(0.3)],
          [{ w: 0.9 }, num(0.6), { w: 0.7 }, { w: 0.6 }, num(0.3)],
          [{ w: 0.8 }, num(0.6), { w: 0.6 }, { w: 0.4 }, num(0.4)],
          [{ w: 0.6 }, num(0.6), { w: 0.7 }, { w: 0.5 }, num(0.3, { story: 700 })],
          [{ w: 0.5, bold: true }, null, null, null, num(0.4, { bold: true, story: 1000 })],
        ],
        4.8,
      );
    case 'contact-list':
      // Names, companies, emails in link blue; the story adds a person.
      return filledSheet(
        [1.2, 1, 1.1, 1.5, 1.2, 1, 1.4],
        [
          head(7),
          [
            { w: 0.8 },
            { w: 0.7 },
            { w: 0.8 },
            { w: 0.8, ink: BLUE },
            { w: 0.8 },
            num(0.7),
            { w: 0.6 },
          ],
          [
            { w: 0.7 },
            { w: 0.6 },
            { w: 0.9 },
            { w: 0.7, ink: BLUE },
            { w: 0.8 },
            num(0.7),
            { w: 0.8 },
          ],
          [
            { w: 0.8 },
            { w: 0.7 },
            { w: 0.8 },
            { w: 0.6, ink: BLUE },
            { w: 0.8 },
            num(0.7),
            { w: 0.7 },
          ],
          [
            { w: 0.7 },
            { w: 0.5 },
            { w: 0.6 },
            { w: 0.7, ink: BLUE },
            { w: 0.8 },
            num(0.7),
            { w: 0.5 },
          ],
          [
            { w: 0.8, story: 700 },
            { w: 0.6, story: 800 },
            { w: 0.7, story: 900 },
            { w: 0.8, ink: BLUE, story: 1000 },
            { w: 0.8, story: 1100 },
            num(0.7, { story: 1200 }),
            null,
          ],
        ],
        5.4,
      );
    case 'task-tracker':
      // On the canvas beside its how-to sticky: a status per task; the story marks one done.
      return (
        <svg width="70" height="44" viewBox="0 0 80 50" aria-hidden>
          <rect
            x="1"
            y="1"
            width="78"
            height="48"
            rx="3"
            fill="rgb(248 250 252)"
            stroke={FRAME}
            strokeWidth="0.8"
          />
          <rect
            x="4"
            y="8"
            width="54"
            height="34"
            rx="1.6"
            fill="white"
            stroke={FRAME}
            strokeWidth="0.5"
          />
          <rect x="6" y="10" width="12" height="1.8" rx="0.9" fill="rgb(51 65 85)" />
          <Grid
            x={6}
            y={14}
            w={50}
            cols={[1.8, 0.9, 1, 0.9]}
            rows={[
              head(4),
              [{ w: 0.7 }, { w: 0.7 }, { w: 0.7, ink: GREEN }, num(0.6)],
              [{ w: 0.8 }, { w: 0.6 }, { w: 0.8, ink: BLUE }, num(0.6)],
              [{ w: 0.6 }, { w: 0.7 }, { w: 0.6, ink: AMBER }, num(0.6)],
              [{ w: 0.9 }, { w: 0.6 }, { w: 0.6, ink: GREEN, story: 900 }, num(0.6)],
              [{ w: 0.7 }, { w: 0.7 }, { w: 0.6, ink: AMBER }, num(0.6)],
            ]}
          />
          <rect x="61" y="8" width="15" height="16" rx="0.8" fill={STICKY} />
          <rect x="63" y="11" width="9" height="1.2" rx="0.6" fill="rgb(113 63 18)" />
          <rect x="63" y="14" width="11" height="0.9" rx="0.45" fill="rgb(161 98 7)" />
          <rect x="63" y="16.4" width="10" height="0.9" rx="0.45" fill="rgb(161 98 7)" />
          <rect x="63" y="18.8" width="8" height="0.9" rx="0.45" fill="rgb(161 98 7)" />
        </svg>
      );
    default:
      return null;
  }
}
