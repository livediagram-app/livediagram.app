// Feature illustrations for Sheets beyond formulas (docs/specs/029-sheets/sheet.md, data-validation.md, conditional-formatting.md): dropdown chips and
// checkboxes, conditional formatting, named ranges and cell comments, and a sheet edited by several
// people at once. Each draws a small grid in the editor's sheet chrome.

import type { ReactNode } from 'react';

import { TEAMMATE, YOU } from '@/components/art-tokens';
import {
  Caret,
  PANEL,
  SHADOW,
  Scene,
  TEXT_BODY,
  TEXT_MUTED,
  TEXT_STRONG,
} from '@liveworkspace/marketing-site/components/feature-art/canvas-marks';
import { Avatar, Pill } from './mode-parts';
import { Frame, MONO } from '@liveworkspace/marketing-site/components/feature-art/shared';

const HEAD_W = 12;
const HEAD_H = 10;
const ROW_H = 13;

/**
 * A grid of `widths` columns and `rows` rows at (x, y): the letter and number headers and the
 * lines. `children` draw the cells' contents over it.
 */
function Grid({
  x,
  y,
  widths,
  rows,
  children,
}: {
  x: number;
  y: number;
  widths: number[];
  rows: number;
  children?: ReactNode;
}) {
  const w = HEAD_W + widths.reduce((a, b) => a + b, 0);
  const h = HEAD_H + rows * ROW_H;
  const colX = widths.map((_, i) => x + HEAD_W + widths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <g>
      <g className={SHADOW}>
        <rect className={PANEL} x={x} y={y} width={w} height={h} rx="2" strokeWidth="0.8" />
      </g>
      <g className="fill-slate-100 dark:fill-slate-700/60">
        <rect x={x} y={y} width={w} height={HEAD_H} />
        <rect x={x} y={y} width={HEAD_W} height={h} />
      </g>
      {widths.map((cw, i) => (
        <text
          key={i}
          className={TEXT_MUTED}
          x={colX[i]! + cw / 2}
          y={y + 7}
          fontSize="5.2"
          fontWeight="600"
          textAnchor="middle"
        >
          {String.fromCharCode(65 + i)}
        </text>
      ))}
      {Array.from({ length: rows }, (_, r) => (
        <text
          key={r}
          className={TEXT_MUTED}
          x={x + HEAD_W / 2}
          y={y + HEAD_H + r * ROW_H + 8.6}
          fontSize="5.2"
          fontWeight="600"
          textAnchor="middle"
        >
          {r + 1}
        </text>
      ))}
      <g className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="0.6" fill="none">
        {Array.from({ length: rows }, (_, r) => (
          <path key={r} d={`M${x} ${y + HEAD_H + r * ROW_H} h${w}`} />
        ))}
        {colX.map((cx) => (
          <path key={cx} d={`M${cx} ${y} v${h}`} />
        ))}
      </g>
      {children}
    </g>
  );
}

/** The y of a cell's text baseline in row `r` of a grid at `y`. */
const rowText = (y: number, r: number) => y + HEAD_H + r * ROW_H + 8.6;

// Dropdowns and checkboxes: a Status column of coloured chips with one open to pick from, and a Done
// column of tick boxes that a COUNTIF counts.
export function SheetValidationArt() {
  const rows = [
    { task: 'Wireframes', status: 'Done', tone: 'emerald' as const, ticked: true },
    { task: 'Copy', status: 'Doing', tone: 'amber' as const, ticked: false },
    { task: 'Images', status: 'To do', tone: 'neutral' as const, ticked: false },
    { task: 'QA', status: 'Doing', tone: 'amber' as const, ticked: false },
  ];
  const x = 14;
  const y = 8;
  return (
    <Frame canvas>
      <Scene>
        <Grid x={x} y={y} widths={[56, 50, 30]} rows={5}>
          {rows.map((r, i) => (
            <g key={r.task}>
              <text className={TEXT_STRONG} x={x + 16} y={rowText(y, i)} fontSize="5.8">
                {r.task}
              </text>
              <Pill x={x + 71} y={rowText(y, i) - 6.6} text={r.status} tone={r.tone} />
              <rect
                x={x + 130}
                y={rowText(y, i) - 6}
                width="7"
                height="7"
                rx="1.4"
                className={
                  r.ticked
                    ? 'fill-brand-500'
                    : 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-500'
                }
                strokeWidth="0.8"
              />
              {r.ticked ? (
                <path
                  d={`M${x + 131.6} ${rowText(y, i) - 2.6} l1.6 1.6 l2.8 -3`}
                  stroke="#fff"
                  strokeWidth="1"
                  fill="none"
                />
              ) : null}
            </g>
          ))}
          <text
            className="fill-brand-700 dark:fill-brand-300"
            x={x + 16}
            y={rowText(y, 4)}
            fontSize="5.4"
            fontFamily={MONO}
          >
            =COUNTIF(C1:C4,TRUE)
          </text>
          <text
            className={TEXT_STRONG}
            x={x + 145}
            y={rowText(y, 4)}
            fontSize="5.8"
            textAnchor="end"
            fontWeight="700"
          >
            1
          </text>
        </Grid>
        {/* The open dropdown under the Copy row's chip. */}
        <g className="fa-d-land">
          <g className={SHADOW}>
            <rect
              className={PANEL}
              x="164"
              y="22"
              width="66"
              height="44"
              rx="3"
              strokeWidth="0.8"
            />
          </g>
          {[
            ['To do', 'neutral'],
            ['Doing', 'amber'],
            ['Done', 'emerald'],
          ].map(([t, tone], i) => (
            <g key={t}>
              {i === 2 ? (
                <rect
                  className="fill-brand-500/15 dark:fill-brand-400/20"
                  x="167"
                  y={25 + i * 13}
                  width="60"
                  height="12"
                  rx="2"
                />
              ) : null}
              <Pill x={171} y={26.6 + i * 13} text={t!} tone={tone as 'neutral'} />
            </g>
          ))}
        </g>
      </Scene>
    </Frame>
  );
}

// Conditional formatting: a column of scores shaded on a colour scale, a rule colouring anything
// over target, and the rule's editor beside it.
export function ConditionalFormatArt() {
  const rows = [
    ['North', 92],
    ['South', 64],
    ['East', 41],
    ['West', 78],
    ['Online', 99],
  ] as const;
  // The scale runs from rose (lowest) through amber to emerald (highest).
  const shade = (v: number) =>
    v >= 85 ? '#bbf7d0' : v >= 70 ? '#d9f99d' : v >= 55 ? '#fde68a' : '#fecaca';
  const x = 14;
  const y = 6;
  return (
    <Frame canvas>
      <Scene>
        <Grid x={x} y={y} widths={[50, 40]} rows={5}>
          {rows.map(([name, v], i) => (
            <g key={name}>
              <text className={TEXT_STRONG} x={x + 16} y={rowText(y, i)} fontSize="5.8">
                {name}
              </text>
              <rect
                className="fa-d-ring"
                style={{ animationDelay: `${i * 0.12}s` }}
                x={x + 62.3}
                y={y + HEAD_H + i * ROW_H + 0.3}
                width="39.4"
                height={ROW_H - 0.6}
                fill={shade(v)}
              />
              <text
                x={x + 98}
                y={rowText(y, i)}
                fontSize="5.8"
                textAnchor="end"
                fill="#1e293b"
                fontWeight={v >= 85 ? 700 : 400}
              >
                {v}
              </text>
            </g>
          ))}
        </Grid>
        {/* The rule's editor. */}
        <g className={SHADOW}>
          <rect className={PANEL} x="134" y="8" width="152" height="80" rx="4" strokeWidth="0.8" />
        </g>
        <text className={TEXT_STRONG} x="142" y="20" fontSize="6.2" fontWeight="700">
          Conditional Formatting
        </text>
        <Pill x={142} y={26} text="Single Colour" tone="neutral" />
        <Pill x={205} y={26} text="Colour Scale" tone="brand" />
        <text className={TEXT_MUTED} x="142" y="46" fontSize="5">
          Minimum
        </text>
        <text className={TEXT_MUTED} x="278" y="46" fontSize="5" textAnchor="end">
          Maximum
        </text>
        <defs>
          <linearGradient id="fa-cf-scale" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="#fecaca" />
            <stop offset="0.5" stopColor="#fde68a" />
            <stop offset="1" stopColor="#bbf7d0" />
          </linearGradient>
        </defs>
        <rect x="142" y="50" width="136" height="8" rx="2" fill="url(#fa-cf-scale)" />
        <text className={TEXT_BODY} x="142" y="72" fontSize="5.4">
          Apply to <tspan fontFamily={MONO}>B1:B5</tspan>
        </text>
        <rect className="fill-brand-700" x="250" y="66" width="28" height="11" rx="2.5" />
        <text x="264" y="73.4" fontSize="5.2" fontWeight="700" fill="#fff" textAnchor="middle">
          Done
        </text>
      </Scene>
    </Frame>
  );
}

// Named ranges and cell comments: TaxRate typed into the name box, a formula reading it by name,
// and an amber corner on the cell with a thread about it.
export function CellCommentsArt() {
  const x = 14;
  const y = 22;
  return (
    <Frame canvas>
      <Scene>
        {/* The name box and the formula bar. */}
        <rect className={PANEL} x={x} y="6" width="40" height="11" rx="2" strokeWidth="0.8" />
        <text
          className={TEXT_STRONG}
          x={x + 4}
          y="13.4"
          fontSize="5.4"
          fontFamily={MONO}
          fontWeight="700"
        >
          TaxRate
        </text>
        <rect className={PANEL} x={x + 44} y="6" width="102" height="11" rx="2" strokeWidth="0.8" />
        <text
          className="fill-brand-700 dark:fill-brand-300"
          x={x + 48}
          y="13.4"
          fontSize="5.4"
          fontFamily={MONO}
        >
          =B2*TaxRate
        </text>
        <Grid x={x} y={y} widths={[50, 42, 42]} rows={4}>
          {[
            ['Desk', '320', '64'],
            ['Chair', '180', '36'],
            ['Lamp', '45', '9'],
          ].map((row, r) => (
            <g key={row[0]}>
              <text className={TEXT_STRONG} x={x + 16} y={rowText(y, r + 1)} fontSize="5.8">
                {row[0]}
              </text>
              <text
                className={TEXT_BODY}
                x={x + 100}
                y={rowText(y, r + 1)}
                fontSize="5.8"
                textAnchor="end"
              >
                {row[1]}
              </text>
              <text
                className={TEXT_BODY}
                x={x + 142}
                y={rowText(y, r + 1)}
                fontSize="5.8"
                textAnchor="end"
              >
                {row[2]}
              </text>
            </g>
          ))}
          <text className={TEXT_MUTED} x={x + 16} y={rowText(y, 0)} fontSize="5.4" fontWeight="700">
            Item
          </text>
          <text
            className={TEXT_MUTED}
            x={x + 100}
            y={rowText(y, 0)}
            fontSize="5.4"
            fontWeight="700"
            textAnchor="end"
          >
            Price
          </text>
          <text
            className={TEXT_MUTED}
            x={x + 142}
            y={rowText(y, 0)}
            fontSize="5.4"
            fontWeight="700"
            textAnchor="end"
          >
            Tax
          </text>
          {/* The commented cell: its amber corner. */}
          <path
            d={`M${x + 140} ${y + HEAD_H + 1 * ROW_H} h6 v6z`}
            transform={`translate(0 0)`}
            fill="#f59e0b"
          />
        </Grid>
        {/* The thread on that cell. */}
        <g className="fa-d-land">
          <g className={SHADOW}>
            <rect
              className={PANEL}
              x="176"
              y="20"
              width="112"
              height="44"
              rx="4"
              strokeWidth="0.8"
            />
          </g>
          <text className={TEXT_MUTED} x="184" y="30" fontSize="5" fontWeight="700">
            Budget!C2
          </text>
          <Avatar x={188} y={41} initials="JR" colour={TEAMMATE} r={4} />
          <text className={TEXT_BODY} x="196" y="43" fontSize="5.4">
            Is the rate 20% here?
          </text>
          <Avatar x={188} y={54} initials="TM" colour={YOU} r={4} />
          <text className={TEXT_BODY} x="196" y="56" fontSize="5.4">
            Yes, UK rate
          </text>
          <Caret x={228} y={51} h={7} />
        </g>
      </Scene>
    </Frame>
  );
}

// A sheet edited together: each person's selection outlined in their colour with their name, two
// people typing in different cells at once.
export function SheetTogetherArt() {
  const x = 40;
  const y = 8;
  const widths = [56, 48, 48, 48];
  const colX = (i: number) => x + HEAD_W + widths.slice(0, i).reduce((a, b) => a + b, 0);
  return (
    <Frame canvas>
      <Scene>
        <Grid x={x} y={y} widths={widths} rows={5}>
          {[
            ['Month', 'Visits', 'Signups', 'Rate'],
            ['July', '8,210', '412', '5.0%'],
            ['August', '9,045', '488', '5.4%'],
            ['September', '10,360', '', ''],
          ].map((row, r) =>
            row.map((cell, c) => (
              <text
                key={`${r}-${c}`}
                className={r === 0 ? TEXT_MUTED : c === 0 ? TEXT_STRONG : TEXT_BODY}
                x={c === 0 ? colX(c) + 4 : colX(c) + widths[c]! - 4}
                y={rowText(y, r)}
                fontSize="5.6"
                fontWeight={r === 0 ? 700 : 400}
                textAnchor={c === 0 ? 'start' : 'end'}
              >
                {cell}
              </text>
            )),
          )}
          {/* Jo typing Signups for September. */}
          <rect
            x={colX(2)}
            y={y + HEAD_H + 3 * ROW_H}
            width={widths[2]}
            height={ROW_H}
            fill="none"
            stroke={TEAMMATE}
            strokeWidth="1.2"
          />
          <rect
            x={colX(2) + widths[2]! - 14}
            y={y + HEAD_H + 4 * ROW_H}
            width="14"
            height="7"
            rx="1.5"
            fill={TEAMMATE}
          />
          <text
            x={colX(2) + widths[2]! - 7}
            y={y + HEAD_H + 4 * ROW_H + 5}
            fontSize="4.6"
            fontWeight="700"
            fill="#fff"
            textAnchor="middle"
          >
            Jo
          </text>
          <g className="fa-d-type">
            <text
              className={TEXT_BODY}
              x={colX(3) - 4}
              y={rowText(y, 3)}
              fontSize="5.6"
              textAnchor="end"
            >
              531
            </text>
          </g>
          {/* You, on the Rate column, filling it down. */}
          <rect
            x={colX(3)}
            y={y + HEAD_H + 3 * ROW_H}
            width={widths[3]}
            height={ROW_H}
            fill="none"
            stroke={YOU}
            strokeWidth="1.2"
          />
          <rect x={colX(3)} y={y + HEAD_H + 4 * ROW_H} width="16" height="7" rx="1.5" fill={YOU} />
          <text
            x={colX(3) + 8}
            y={y + HEAD_H + 4 * ROW_H + 5}
            fontSize="4.6"
            fontWeight="700"
            fill="#fff"
            textAnchor="middle"
          >
            You
          </text>
          <text
            className="fill-brand-700 dark:fill-brand-300"
            x={colX(3) + 4}
            y={rowText(y, 3)}
            fontSize="5"
            fontFamily={MONO}
          >
            =C4/B4
          </text>
        </Grid>
      </Scene>
    </Frame>
  );
}
