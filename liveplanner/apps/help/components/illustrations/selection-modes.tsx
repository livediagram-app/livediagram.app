// Selection-mode illustrations (docs/specs/018-help/help-app.md): the palette's canvas-tool picker
// as the editor actually draws it (a trigger at the start of the palette strip that
// opens a tile grid in two bands), the panels each tool opens while it is
// active, and the isometric orbit button. The per-mode canvas scenes in palette-modes.tsx put PickerTrigger on
// top, so every selection-mode article shows the same picker with its own tool
// chosen.
//
// Labels are lifted from apps/editor: canvas-tool-options.tsx (tool names,
// shortcuts, bands), the *-config.ts catalogues (panel rows and values), and
// TopCenterChrome.tsx (the Format banner).

import type {} from 'react';
import { Label } from './primitives';
import {
  HandGlyph,
  IsometricGlyph,
  PainterGlyph,
  SelectGlyph,
  ZenGlyph,
} from './palette-modes-parts';

// --- The picker -------------------------------------------------------------

/** The palette's canvas tools, in the picker's own order and bands. */
const TOOLS = [
  { key: 'select', label: 'Select', shortcut: 'V', band: 0, Glyph: SelectGlyph },
  { key: 'hand', label: 'Hand', shortcut: 'H', band: 0, Glyph: HandGlyph },
  { key: 'format', label: 'Format', shortcut: undefined, band: 0, Glyph: PainterGlyph },
  { key: 'isometric', label: 'Isometric', shortcut: 'I', band: 1, Glyph: IsometricGlyph },
  { key: 'zen', label: 'Zen', shortcut: 'Z', band: 1, Glyph: ZenGlyph },
] as const;

type ToolKey = (typeof TOOLS)[number]['key'];

function Chevron({ x, y }: { x: number; y: number }) {
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

// --- Tool panels --------------------------------------------------------------

// --- Isometric ----------------------------------------------------------------
