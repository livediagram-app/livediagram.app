// The palette's canvas-tool picker as the editor draws it (selection-modes.tsx): a trigger at the start of the
// palette strip that opens a tile grid in three bands. Labels are lifted from apps/live canvas-tool-options.tsx
// (tool names, shortcuts, bands).

import type { ReactNode } from 'react';
import { Scene, Label } from '@liveworkspace/help-site/art/primitives';
import { Card, Strip } from './editor-chrome';
import {
  EraserGlyph,
  HandGlyph,
  LaserGlyph,
  PainterGlyph,
  SelectGlyph,
  SpotlightGlyph,
  ZenGlyph,
} from '@liveworkspace/help-site/art/illustrations/palette-modes-parts';

// --- The picker -------------------------------------------------------------

/** The palette's canvas tools, in the picker's own order and bands. */
const TOOLS = [
  { key: 'select', label: 'Select', shortcut: 'V', band: 0, Glyph: SelectGlyph },
  { key: 'hand', label: 'Hand', shortcut: 'H', band: 0, Glyph: HandGlyph },
  { key: 'eraser', label: 'Eraser', shortcut: 'E', band: 0, Glyph: EraserGlyph },
  { key: 'format', label: 'Format', shortcut: undefined, band: 0, Glyph: PainterGlyph },
  { key: 'laser', label: 'Laser', shortcut: 'K', band: 1, Glyph: LaserGlyph },
  { key: 'spotlight', label: 'Spotlight', shortcut: undefined, band: 1, Glyph: SpotlightGlyph },
  { key: 'zen', label: 'Zen', shortcut: 'Z', band: 2, Glyph: ZenGlyph },
] as const;

type ToolKey = (typeof TOOLS)[number]['key'];

const BANDS = ['EDIT', 'PRESENT', 'PREVIEW'] as const;

export function Chevron({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M${x - 3.5} ${y - 1.5} l3.5 3.5 l3.5 -3.5`}
      className="stroke-slate-400"
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** The palette strip across the top of the canvas, its select-mode pill showing the chosen tool, with the tooltip
 *  naming it under the pill. Sits at the top of every mode scene; the scene's edge crops the strip's far end. */
export function PickerTrigger({
  x = 8,
  y = 8,
  tool,
  tip = true,
}: {
  x?: number;
  y?: number;
  tool: ToolKey;
  tip?: boolean;
}) {
  const t = TOOLS.find((o) => o.key === tool) ?? TOOLS[0];
  const label = t.shortcut ? `${t.label}  ${t.shortcut}` : t.label;
  const tw = label.length * 5 + 14;
  return (
    <g>
      <Strip
        x={x}
        y={y}
        tool={
          <g transform="scale(0.72)">
            <t.Glyph />
          </g>
        }
      />
      {tip && (
        <g>
          <rect
            x={x + 15 - tw / 2 + 6}
            y={y + 30}
            width={tw}
            height={16}
            rx={4}
            className="fill-slate-800"
          />
          <Label
            x={x + 21}
            y={y + 38.5}
            size={9}
            weight={500}
            anchor="middle"
            className="fill-white help-art-as-drawn"
          >
            {label}
          </Label>
        </g>
      )}
    </g>
  );
}

/** The canvas-tool picker opened: the trigger, and the tile grid hanging below
 *  it in its three named bands, with the current tool in its selected tone and
 *  the shortcut letters in the tiles' corners. */
export function ToolPicker({ active = 'select' }: { active?: ToolKey }) {
  const mx = 8;
  const tileW = 80;
  const tileH = 42;
  const gap = 4;
  const menuW = 3 * tileW + 2 * gap + 16;
  const rows: { band: number; tools: (typeof TOOLS)[number][] }[] = [];
  for (const b of [0, 1, 2]) {
    const inBand = TOOLS.filter((t) => t.band === b);
    for (let i = 0; i < inBand.length; i += 3)
      rows.push({ band: b, tools: inBand.slice(i, i + 3) });
  }
  let cy = 52;
  const body: ReactNode[] = [];
  let lastBand = -1;
  rows.forEach((row, r) => {
    if (row.band !== lastBand) {
      if (lastBand !== -1) {
        body.push(
          <line
            key={`rule-${r}`}
            x1={mx + 8}
            y1={cy + 2}
            x2={mx + menuW - 8}
            y2={cy + 2}
            className="stroke-slate-200"
            strokeWidth={0.75}
          />,
        );
        cy += 6;
      }
      body.push(
        <Label key={`band-${r}`} x={mx + 12} y={cy + 8} size={10} weight={700} tone="muted">
          {BANDS[row.band]}
        </Label>,
      );
      cy += 18;
      lastBand = row.band;
    }
    row.tools.forEach((t, i) => {
      const tx = mx + 8 + i * (tileW + gap);
      const on = t.key === active;
      body.push(
        <g key={t.key}>
          <rect
            x={tx}
            y={cy}
            width={tileW}
            height={tileH}
            rx={6}
            className={on ? 'fill-brand-100' : row.band === 0 ? 'fill-slate-50' : 'fill-slate-100'}
          />
          <g transform={`translate(${tx + tileW / 2} ${cy + 14})`}>
            <t.Glyph />
          </g>
          <Label
            x={tx + tileW / 2}
            y={cy + 32}
            size={10.5}
            weight={on ? 700 : 500}
            anchor="middle"
            tone={on ? 'accent' : 'body'}
          >
            {t.label}
          </Label>
          {t.shortcut && (
            <Label x={tx + tileW - 5} y={cy + 8} size={10} weight={600} anchor="end" tone="muted">
              {t.shortcut}
            </Label>
          )}
        </g>,
      );
    });
    cy += tileH + gap;
  });
  const menuH = cy - 48 + 6;
  return (
    <Scene w={420} h={menuH + 60}>
      <PickerTrigger x={mx} y={8} tool={active} tip={false} />
      <Card x={mx} y={44} w={menuW} h={menuH} r={8} />
      {body}
    </Scene>
  );
}
