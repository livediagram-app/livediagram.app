'use client';

// The Spreadsheets pictures (docs/specs/026-plan/plan-mode.md "Start Planning", docs/specs/029-sheets/sheet.md "Sheet
// templates"): each sheet type drawn small as it will look. A template shows its own look: the title in its accent,
// its header row in its colour, banded rows with numbers to the right, a ruled total, its summary fields and the
// chart it places. The empty sheet shows a grid with a cell picked; the Card Table its chips. Start Planning and Add
// to Slot draw them.
import { useMemo } from 'react';
import {
  accentColour,
  accentHead,
  mixHex,
  sheetTemplate,
  sheetTemplateInfo,
  type SheetTemplateId,
} from '@liveplanner/sheets';
import type { PlacedSheetStart } from '@/lib/sheet-seeds';
import type { PlanPalette } from './plan-palette';

// The Spreadsheets tab's sheet types (docs/specs/026-plan/plan-mode.md "Start Planning"): the empty sheet, the card
// table, then every template; each opens Setup Sheet a step in (sheet-seeds' PlacedSheetStart).
export type SheetTile = { start: PlacedSheetStart | null; name: string; line: string };

// The picture's box (the tile scales it to its width).
const W = 160;
const H = 96;
const PAD = 8;
// The most table columns a picture draws, and body rows.
const COLS_MAX = 5;
const ROWS = 5;
// The chips' colours, in turn down a column (a Card Table's types and states).
const CHIP_COLOURS = ['#0ea5e9', '#8b5cf6', '#10b981'];

// What a template's picture needs from its design: its table's columns (number or text) and whether it has a total,
// its summary fields, and its chart.
type Shape = {
  accent: string;
  head: string;
  numeric: boolean[];
  total: boolean;
  fields: number;
  chart?: 'pie-chart' | 'bar-chart' | 'line-chart';
};

function shapeOf(id: SheetTemplateId): Shape {
  const info = sheetTemplateInfo(id);
  const design = sheetTemplate(id, 0);
  const table = design.blocks.find((b) => b.kind === 'table');
  const fields = design.blocks.find((b) => b.kind === 'fields' && b.at[1] > 0);
  const numeric = (table?.kind === 'table' ? table.head : []).map((_, j) => {
    const nf = table?.kind === 'table' ? table.formats?.[j]?.nf : undefined;
    return !!nf && nf !== 'text' && nf !== 'date';
  });
  return {
    accent: accentColour(info.accent),
    head: accentHead(info.accent),
    numeric: numeric.slice(0, COLS_MAX),
    total: table?.kind === 'table' && !!table.total,
    fields: fields?.kind === 'fields' ? Math.min(4, fields.items.length) : 0,
    ...(info.chart ? { chart: info.chart } : {}),
  };
}

function Chart({
  kind,
  x,
  y,
  w,
  h,
  accent,
}: {
  kind: NonNullable<Shape['chart']>;
  x: number;
  y: number;
  w: number;
  h: number;
  accent: string;
}) {
  const shades = [
    accent,
    mixHex(accent, '#ffffff', 0.6),
    mixHex(accent, '#000000', 0.65),
    mixHex(accent, '#ffffff', 0.3),
  ];
  if (kind === 'pie-chart') {
    const r = Math.min(w, h) / 2 - 2;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const cuts = [0, 0.42, 0.68, 0.86, 1];
    const at = (t: number) =>
      [cx + r * Math.sin(t * 2 * Math.PI), cy - r * Math.cos(t * 2 * Math.PI)] as const;
    return (
      <g>
        {cuts.slice(0, -1).map((t, i) => {
          const [x1, y1] = at(t);
          const [x2, y2] = at(cuts[i + 1]!);
          const large = cuts[i + 1]! - t > 0.5 ? 1 : 0;
          return (
            <path
              key={i}
              d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`}
              fill={shades[i]}
            />
          );
        })}
      </g>
    );
  }
  if (kind === 'bar-chart') {
    const heights = [0.55, 0.85, 0.4, 0.7];
    const bw = w / (heights.length * 1.6);
    return (
      <g>
        <line
          x1={x}
          x2={x + w}
          y1={y + h}
          y2={y + h}
          stroke={accent}
          strokeOpacity={0.4}
          strokeWidth={0.8}
        />
        {heights.map((t, i) => (
          <rect
            key={i}
            x={x + bw * 0.4 + i * bw * 1.6}
            y={y + h - t * h}
            width={bw}
            height={t * h}
            rx={1}
            fill={i === 1 ? accent : mixHex(accent, '#ffffff', 0.45)}
          />
        ))}
      </g>
    );
  }
  const a = [0.15, 0.25, 0.4, 0.6, 0.85];
  const b = [0.85, 0.7, 0.55, 0.35, 0.15];
  const pts = (vals: number[]) =>
    vals.map((t, i) => `${x + (i * w) / (vals.length - 1)},${y + h - t * h}`).join(' ');
  return (
    <g fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <line
        x1={x}
        x2={x + w}
        y1={y + h}
        y2={y + h}
        stroke={accent}
        strokeOpacity={0.4}
        strokeWidth={0.8}
      />
      <polyline points={pts(a)} stroke={accent} />
      <polyline points={pts(b)} stroke={mixHex(accent, '#ffffff', 0.45)} />
    </g>
  );
}

function TemplatePicture({ id, palette }: { id: SheetTemplateId; palette: PlanPalette }) {
  const s = useMemo(() => shapeOf(id), [id]);
  const side = s.chart || s.fields ? 52 : 0;
  const tableW = W - PAD * 2 - (side ? side + 6 : 0);
  const cols = s.numeric.length || 4;
  const colW = tableW / cols;
  const top = 26;
  const rowH = 9;
  const bar = (x: number, y: number, w: number, fill: string, opacity: number, key: string) => (
    <rect
      key={key}
      x={x}
      y={y - 1.25}
      width={Math.max(2, w)}
      height={2.5}
      rx={1.25}
      fill={fill}
      fillOpacity={opacity}
    />
  );
  const sideX = PAD + tableW + 6;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* The title in the accent, the subtitle quiet under it. */}
      <rect x={PAD} y={7} width={46} height={5} rx={2.5} fill={s.head} />
      <rect
        x={PAD}
        y={16}
        width={78}
        height={2.5}
        rx={1.25}
        fill={palette.muted}
        fillOpacity={0.45}
      />
      {/* The header row. */}
      <rect x={PAD} y={top} width={tableW} height={rowH} rx={1.5} fill={s.head} />
      {Array.from({ length: cols }, (_, j) =>
        bar(
          PAD + j * colW + (s.numeric[j] ? colW * 0.4 : 3),
          top + rowH / 2,
          colW * 0.5 - 3,
          '#ffffff',
          0.85,
          `h${j}`,
        ),
      )}
      {/* Body rows, every other one tinted, numbers to the right. */}
      {Array.from({ length: ROWS }, (_, i) => {
        const y = top + rowH * (i + 1);
        return (
          <g key={i}>
            {i % 2 === 1 ? (
              <rect x={PAD} y={y} width={tableW} height={rowH} fill={s.accent} fillOpacity={0.1} />
            ) : null}
            {Array.from({ length: cols }, (_, j) => {
              const w = s.numeric[j] ? colW * 0.42 : colW * (0.4 + ((i * 3 + j * 5) % 4) * 0.1);
              const x = s.numeric[j] ? PAD + (j + 1) * colW - 3 - w : PAD + j * colW + 3;
              return bar(
                x,
                y + rowH / 2,
                w,
                s.numeric[j] ? palette.text : palette.muted,
                s.numeric[j] ? 0.6 : 0.4,
                `c${j}`,
              );
            })}
          </g>
        );
      })}
      {/* The total, ruled in the accent. */}
      {s.total ? (
        <g>
          <rect
            x={PAD}
            y={top + rowH * (ROWS + 1)}
            width={tableW}
            height={rowH}
            fill={s.accent}
            fillOpacity={0.18}
          />
          <line
            x1={PAD}
            x2={PAD + tableW}
            y1={top + rowH * (ROWS + 1)}
            y2={top + rowH * (ROWS + 1)}
            stroke={s.head}
            strokeWidth={1.2}
          />
          {bar(PAD + 3, top + rowH * (ROWS + 1.5), colW * 0.45, palette.text, 0.8, 'tl')}
          {bar(
            PAD + tableW - 3 - colW * 0.45,
            top + rowH * (ROWS + 1.5),
            colW * 0.45,
            palette.text,
            0.8,
            'tv',
          )}
        </g>
      ) : null}
      {/* The summary fields, then the chart beside the table. */}
      {s.fields ? (
        <g>
          <line
            x1={sideX}
            x2={W - PAD}
            y1={top + 1}
            y2={top + 1}
            stroke={s.accent}
            strokeWidth={1}
          />
          {Array.from({ length: s.chart ? 2 : s.fields }, (_, i) => (
            <g key={i}>
              {bar(sideX, top + 6 + i * 7, 20, palette.muted, 0.45, `fl${i}`)}
              {bar(
                W - PAD - 16,
                top + 6 + i * 7,
                16,
                i === 0 ? s.head : palette.text,
                i === 0 ? 0.9 : 0.55,
                `fv${i}`,
              )}
            </g>
          ))}
        </g>
      ) : null}
      {s.chart ? (
        <Chart
          kind={s.chart}
          x={sideX + 2}
          y={s.fields ? top + 22 : top}
          w={side - 4}
          h={s.fields ? 38 : 56}
          accent={s.accent}
        />
      ) : null}
    </svg>
  );
}

// A sheet drawn small: a template as it will look, else a grid (the empty sheet's picked cell, a card table's chips).
export function SheetPreview({ palette, tile }: { palette: PlanPalette; tile: SheetTile }) {
  const start = tile.start;
  return (
    <div
      aria-hidden
      className="h-16 w-full overflow-hidden rounded-lg border sm:h-24"
      style={{ backgroundColor: palette.surface, borderColor: palette.border }}
    >
      {start && start !== 'cards' ? (
        <TemplatePicture id={start} palette={palette} />
      ) : (
        <GridPicture palette={palette} cards={start === 'cards'} />
      )}
    </div>
  );
}

function GridPicture({ palette, cards }: { palette: PlanPalette; cards: boolean }) {
  const cw = W / 4;
  const rh = H / 4;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <rect x={0} y={0} width={W} height={rh} fill={palette.column} />
      {[1, 2, 3].map((i) => (
        <g key={i} stroke={palette.cardBorder} strokeWidth={1}>
          <line x1={0} x2={W} y1={i * rh} y2={i * rh} />
          <line x1={i * cw} x2={i * cw} y1={0} y2={H} />
        </g>
      ))}
      {cards ? (
        [1, 2, 3].flatMap((r) =>
          [0, 1, 2, 3].map((c) => (
            <rect
              key={`${r}-${c}`}
              x={c * cw + 6}
              y={r * rh + rh / 2 - 2}
              width={cw * (c === 0 || c === 3 ? 0.6 : 0.5)}
              height={4}
              rx={2}
              fill={
                c === 0 || c === 3 ? CHIP_COLOURS[(r + c) % CHIP_COLOURS.length] : palette.muted
              }
              fillOpacity={c === 0 || c === 3 ? 0.8 : 0.45}
            />
          )),
        )
      ) : (
        <rect
          x={cw + 1}
          y={rh + 1}
          width={cw - 2}
          height={rh - 2}
          fill={palette.focus}
          fillOpacity={0.25}
          stroke={palette.focus}
          strokeWidth={1.5}
        />
      )}
    </svg>
  );
}
