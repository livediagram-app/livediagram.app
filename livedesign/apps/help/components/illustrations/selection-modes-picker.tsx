// The palette's canvas-tool picker as the editor draws it (selection-modes.tsx): a trigger at the start of the
// palette strip that opens a tile grid in three bands. Labels are lifted from apps/live canvas-tool-options.tsx
// (tool names, shortcuts, bands).

import type { ReactNode } from 'react';
import { Scene, Label } from '@liveworkspace/help-site/art/primitives';
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

/** The start of the palette strip across the top of the canvas: the canvas-tool picker on the
 *  left (showing the chosen tool) and the category picker beside it. Sits at the top of every
 *  mode scene. */
export function PickerTrigger({ x = 24, y = 14, tool }: { x?: number; y?: number; tool: ToolKey }) {
  const t = TOOLS.find((o) => o.key === tool) ?? TOOLS[0];
  const w = 236;
  return (
    <g>
      <rect
        x={x}
        y={y + 22}
        width={w}
        height={36}
        rx={9}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      <rect
        x={x + 8}
        y={y + 28}
        width={122}
        height={24}
        rx={6}
        className="fill-brand-50 stroke-brand-200"
        strokeWidth={1.2}
      />
      <g transform={`translate(${x + 21} ${y + 40})`}>
        <t.Glyph />
      </g>
      <Label x={x + 34} y={y + 41} size={11} weight={600} tone="strong">
        {t.label}
      </Label>
      <Chevron x={x + 120} y={y + 40} />
      <line
        x1={x + 140}
        y1={y + 30}
        x2={x + 140}
        y2={y + 50}
        className="stroke-slate-200"
        strokeWidth={1.2}
      />
      <Label x={x + 150} y={y + 41} size={11} weight={500} tone="body">
        Popular
      </Label>
      <Chevron x={x + w - 16} y={y + 40} />
    </g>
  );
}

/** The canvas-tool picker opened: the trigger, and the tile grid hanging below
 *  it in its three named bands, with the current tool in its selected tone and
 *  the shortcut letters in the tiles' corners. */
export function ToolPicker({ active = 'select' }: { active?: ToolKey }) {
  const mx = 84;
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
  let cy = 84;
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
            strokeWidth={1}
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
  const menuH = cy - 80 + 6;
  return (
    <Scene w={420} h={menuH + 92}>
      <PickerTrigger x={mx} y={10} tool={active} />
      <rect
        x={mx}
        y={76}
        width={menuW}
        height={menuH}
        rx={10}
        className="fill-white stroke-slate-200"
        strokeWidth={1.5}
      />
      {body}
    </Scene>
  );
}
