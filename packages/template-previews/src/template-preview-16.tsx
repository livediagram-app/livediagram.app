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
// Each sheet template's accent (@livediagram/sheets sheet-templates, sheet.md "Sheet templates"): its header fill
// (the family's 700, white text) and its banded rows' wash.
const ACCENTS = {
  emerald: { head: '#047857', band: '#ecfdf5', hue: '#10b981' },
  sky: { head: '#0369a1', band: '#f0f9ff', hue: '#0ea5e9' },
  indigo: { head: '#4338ca', band: '#eef2ff', hue: '#6366f1' },
  violet: { head: '#6d28d9', band: '#f5f3ff', hue: '#8b5cf6' },
  blue: { head: '#1d4ed8', band: '#eff6ff', hue: '#3b82f6' },
  amber: { head: '#b45309', band: '#fffbeb', hue: '#f59e0b' },
  cyan: { head: '#0e7490', band: '#ecfeff', hue: '#06b6d4' },
  teal: { head: '#0f766e', band: '#f0fdfa', hue: '#14b8a6' },
  orange: { head: '#c2410c', band: '#fff7ed', hue: '#f97316' },
  rose: { head: '#be123c', band: '#fff1f2', hue: '#f43f5e' },
  purple: { head: '#7e22ce', band: '#faf5ff', hue: '#a855f7' },
  fuchsia: { head: '#a21caf', band: '#fdf4ff', hue: '#d946ef' },
} as const;
type Accent = (typeof ACCENTS)[keyof typeof ACCENTS];
const HEAD_INK = 'rgb(255 255 255)';
const INK = 'rgb(148 163 184)';
const BOLD = 'rgb(71 85 105)';
const GREEN = 'rgb(22 163 74)';
const RED = 'rgb(220 38 38)';
const BLUE = 'rgb(37 99 235)';
const AMBER = 'rgb(217 119 6)';
const STICKY = 'rgb(254 240 138)';

// A cell's content: a grey line `w` of the cell wide (0 to 1), a colour, bold, right-aligned (a number).
type Cell = { w: number; ink?: string; bold?: boolean; right?: boolean; story?: number } | null;

// The grid at (x, y), `w` wide: a ruler of column letters, then the header row in the accent, then the rows, every
// other one banded. Columns share the width by `cols` weights.
function Grid({
  x,
  y,
  w,
  cols,
  rows,
  rowH = 4.2,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  cols: number[];
  rows: Cell[][];
  rowH?: number;
  accent: Accent;
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
      <rect x={x + gutter} y={top} width={w - gutter} height={rowH} fill={accent.head} />
      {rows.map((_, r) =>
        r > 0 && r % 2 === 0 ? (
          <rect
            key={`b${r}`}
            x={x + gutter}
            y={top + r * rowH}
            width={w - gutter}
            height={rowH}
            fill={accent.band}
          />
        ) : null,
      )}
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

// A template's chart, small: a pie, bars or a falling line in its accent.
function MiniChart({
  kind,
  x,
  y,
  size,
  accent,
}: {
  kind: 'pie' | 'bar' | 'line';
  x: number;
  y: number;
  size: number;
  accent: Accent;
}) {
  if (kind === 'bar')
    return (
      <g>
        {[0.55, 0.9, 0.4, 0.7].map((t, i) => (
          <rect
            key={i}
            x={x + i * (size / 4) + 0.6}
            y={y + size * (1 - t)}
            width={size / 4 - 1.2}
            height={size * t}
            rx="0.4"
            fill={i === 1 ? accent.head : accent.hue}
            opacity={i === 1 ? 1 : 0.6}
          />
        ))}
      </g>
    );
  if (kind === 'line')
    return (
      <g>
        <rect x={x} y={y + size} width={size} height="0.4" fill={GRID} />
        <path
          d={`M${x},${y + size * 0.1} L${x + size * 0.35},${y + size * 0.35} L${x + size * 0.7},${y + size * 0.65} L${x + size},${y + size * 0.95}`}
          fill="none"
          stroke={accent.head}
          strokeWidth="0.9"
        />
        <path
          d={`M${x},${y + size * 0.85} L${x + size * 0.5},${y + size * 0.6} L${x + size},${y + size * 0.3}`}
          fill="none"
          stroke={accent.hue}
          strokeWidth="0.7"
        />
      </g>
    );
  const r = size / 2;
  const cx = x + r;
  const cy = y + r;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={accent.hue} opacity="0.55" />
      <path
        d={`M${cx},${cy} L${cx},${cy - r} A${r},${r} 0 1 1 ${cx - r * 0.95},${cy + r * 0.3} Z`}
        fill={accent.head}
      />
    </g>
  );
}

// A sheet filling the tile, as one filling its tab: the title in its accent over the grid, and, for a template with
// a summary and a chart, those beside it.
function filledSheet(
  accent: Accent,
  cols: number[],
  rows: Cell[][],
  rowH?: number,
  chart?: 'pie' | 'bar' | 'line',
): ReactElement {
  const gridW = chart ? 52 : 72;
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
      <rect x="4" y="3.6" width="20" height="2.6" rx="1.2" fill={accent.head} />
      <rect x="4" y="7.6" width="40" height="1.2" rx="0.6" fill={RULER} />
      <Grid
        x={4}
        y={11}
        w={gridW}
        cols={cols}
        rows={rows}
        accent={accent}
        {...(rowH ? { rowH } : {})}
      />
      {chart ? (
        <g>
          <rect x="59" y="13.6" width="17" height="0.6" fill={accent.hue} />
          <rect x="59" y="16" width="8" height="1" rx="0.5" fill={INK} />
          <rect x="70" y="15.8" width="6" height="1.4" rx="0.7" fill={accent.head} />
          <rect x="59" y="19" width="8" height="1" rx="0.5" fill={INK} />
          <rect x="71" y="19" width="5" height="1" rx="0.5" fill={BOLD} />
          <MiniChart kind={chart} x={60} y={25} size={15} accent={accent} />
        </g>
      ) : null}
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
        ACCENTS.emerald,
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
        undefined,
        'pie',
      );
    case 'timesheet':
      // A week of hours; the story fills Friday's and the total.
      return filledSheet(
        ACCENTS.sky,
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
        'pie',
      );
    case 'contact-list':
      // Names, companies, emails in link blue; the story adds a person.
      return filledSheet(
        ACCENTS.indigo,
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
          <rect x="6" y="10" width="14" height="2" rx="1" fill={ACCENTS.violet.head} />
          <Grid
            x={6}
            y={14}
            w={50}
            accent={ACCENTS.violet}
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
          <MiniChart kind="bar" x={62} y={28} size={13} accent={ACCENTS.violet} />
        </svg>
      );
    case 'invoice':
      // Line items, quantity, price and amount; the story adds a line and the amount due.
      return filledSheet(
        ACCENTS.blue,
        [2, 0.7, 1, 1],
        [
          head(4),
          [{ w: 0.8 }, num(0.4), num(0.6), num(0.6)],
          [{ w: 0.7 }, num(0.4), num(0.6), num(0.6)],
          [{ w: 0.9 }, num(0.4), num(0.5), num(0.6)],
          [
            { w: 0.6, story: 600 },
            num(0.4, { story: 700 }),
            num(0.5, { story: 800 }),
            num(0.6, { story: 900 }),
          ],
          [null, null, { w: 0.6, bold: true }, num(0.6)],
          [null, null, { w: 0.6, bold: true }, num(0.7, { bold: true, ink: BLUE, story: 1100 })],
        ],
        4.8,
      );
    case 'expense-report':
      // Claims with receipts ticked; the story adds a claim and its total.
      return filledSheet(
        ACCENTS.amber,
        [1, 1.6, 1, 0.8, 1],
        [
          head(5),
          [{ w: 0.7 }, { w: 0.8 }, { w: 0.6 }, { w: 0.4, ink: GREEN }, num(0.5)],
          [{ w: 0.7 }, { w: 0.6 }, { w: 0.7 }, { w: 0.4, ink: GREEN }, num(0.6)],
          [{ w: 0.7 }, { w: 0.9 }, { w: 0.5 }, { w: 0.4, ink: RED }, num(0.4)],
          [{ w: 0.7 }, { w: 0.7 }, { w: 0.6 }, { w: 0.4, ink: GREEN }, num(0.5)],
          [
            { w: 0.7, story: 700 },
            { w: 0.8, story: 800 },
            { w: 0.6, story: 900 },
            { w: 0.4, ink: GREEN, story: 1000 },
            num(0.5, { story: 1100 }),
          ],
          [{ w: 0.5, bold: true }, null, null, null, num(0.6, { bold: true })],
        ],
        undefined,
        'pie',
      );
    case 'loan-calculator':
      // The schedule by year, the balance falling; the story fills the next year.
      return filledSheet(
        ACCENTS.cyan,
        [0.7, 1, 1, 1],
        [
          head(4),
          [num(0.4), num(0.6), num(0.5), num(0.7)],
          [num(0.4), num(0.6), num(0.5), num(0.65)],
          [num(0.4), num(0.6), num(0.55), num(0.55)],
          [num(0.4), num(0.6), num(0.6), num(0.45)],
          [
            num(0.4, { story: 700 }),
            num(0.6, { story: 800 }),
            num(0.65, { story: 900 }),
            num(0.35, { story: 1000 }),
          ],
          [{ w: 0.5, bold: true }, num(0.7, { bold: true, ink: BLUE }), null, null],
        ],
        undefined,
        'line',
      );
    case 'sales-pipeline':
      // Deals by stage with a probability; the story closes one.
      return filledSheet(
        ACCENTS.teal,
        [1.4, 1, 0.8, 1, 1],
        [
          head(5),
          [{ w: 0.8 }, { w: 0.7 }, num(0.4), num(0.6), num(0.5)],
          [{ w: 0.7 }, { w: 0.6, ink: BLUE }, num(0.4), num(0.6), num(0.5)],
          [{ w: 0.9 }, { w: 0.7, ink: AMBER }, num(0.4), num(0.5), num(0.4)],
          [
            { w: 0.6 },
            { w: 0.7, ink: GREEN, story: 800 },
            num(0.4, { story: 900 }),
            num(0.6),
            num(0.6, { story: 1000 }),
          ],
          [{ w: 0.8 }, { w: 0.6 }, num(0.4), num(0.5), num(0.3)],
          [{ w: 0.5, bold: true }, null, null, num(0.7, { bold: true }), num(0.6, { bold: true })],
        ],
        undefined,
        'bar',
      );
    case 'inventory':
      // Stock and value, a reorder flagged red; the story restocks it.
      return filledSheet(
        ACCENTS.orange,
        [1.5, 0.8, 0.8, 1, 1],
        [
          head(5),
          [{ w: 0.8 }, num(0.4), num(0.4), num(0.6), { w: 0.5, ink: GREEN }],
          [{ w: 0.7 }, num(0.3), num(0.4), num(0.5), { w: 0.6, ink: RED }],
          [{ w: 0.9 }, num(0.4), num(0.4), num(0.6), { w: 0.5, ink: GREEN }],
          [
            { w: 0.6 },
            num(0.4, { story: 800 }),
            num(0.4),
            num(0.6, { story: 900 }),
            { w: 0.5, ink: GREEN, story: 1000 },
          ],
          [{ w: 0.8 }, num(0.4), num(0.4), num(0.5), { w: 0.5, ink: GREEN }],
          [{ w: 0.5, bold: true }, null, null, num(0.7, { bold: true }), null],
        ],
        undefined,
        'bar',
      );
    case 'guest-list':
      // Guests with their RSVP; the story says yes for one more.
      return filledSheet(
        ACCENTS.rose,
        [1.5, 0.9, 0.7, 1.1],
        [
          head(4),
          [{ w: 0.8 }, { w: 0.5, ink: GREEN }, num(0.3), { w: 0.6 }],
          [{ w: 0.7 }, { w: 0.5, ink: GREEN }, num(0.3), { w: 0.5 }],
          [{ w: 0.9 }, { w: 0.5, ink: RED }, num(0.3), null],
          [{ w: 0.6 }, { w: 0.5, ink: AMBER }, num(0.3), { w: 0.7 }],
          [
            { w: 0.8, story: 700 },
            { w: 0.5, ink: GREEN, story: 900 },
            num(0.3, { story: 1000 }),
            null,
          ],
          [{ w: 0.5, bold: true }, null, num(0.4, { bold: true }), null],
        ],
        undefined,
        'pie',
      );
    case 'grade-book':
      // Scores, an average and a grade per student; the story marks one more test.
      return filledSheet(
        ACCENTS.purple,
        [1.5, 0.8, 0.8, 0.8, 0.9, 0.7],
        [
          head(6),
          [
            { w: 0.8 },
            num(0.5),
            num(0.5),
            num(0.5),
            num(0.5, { bold: true }),
            { w: 0.4, ink: GREEN },
          ],
          [
            { w: 0.7 },
            num(0.5),
            num(0.5),
            num(0.5),
            num(0.5, { bold: true }),
            { w: 0.4, ink: GREEN },
          ],
          [
            { w: 0.9 },
            num(0.5),
            num(0.5),
            num(0.5),
            num(0.5, { bold: true }),
            { w: 0.4, ink: RED },
          ],
          [
            { w: 0.6 },
            num(0.5),
            num(0.5),
            num(0.5, { story: 800 }),
            num(0.5, { bold: true, story: 1000 }),
            { w: 0.4, ink: GREEN, story: 1100 },
          ],
          [
            { w: 0.8 },
            num(0.5),
            num(0.5),
            num(0.5),
            num(0.5, { bold: true }),
            { w: 0.4, ink: GREEN },
          ],
        ],
        5,
        'bar',
      );
    case 'habit-tracker':
      // A week of ticks per habit; the story ticks today.
      return filledSheet(
        ACCENTS.fuchsia,
        [1.6, 0.5, 0.5, 0.5, 0.5, 0.5, 0.8],
        [
          head(7),
          [
            { w: 0.8 },
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN },
            null,
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN, story: 800 },
            num(0.5),
          ],
          [
            { w: 0.7 },
            { w: 0.5, ink: GREEN },
            null,
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN, story: 1000 },
            num(0.5),
          ],
          [{ w: 0.9 }, null, { w: 0.5, ink: GREEN }, { w: 0.5, ink: GREEN }, null, null, num(0.5)],
          [
            { w: 0.6 },
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN },
            { w: 0.5, ink: GREEN, story: 1200 },
            num(0.5),
          ],
        ],
        5.4,
        'bar',
      );
    default:
      return null;
  }
}
