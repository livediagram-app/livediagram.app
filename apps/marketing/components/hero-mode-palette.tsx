// What the hero's Palette strip offers in each editor mode (docs/specs/007-editor/editor-modes.md
// "The palette per mode"): the mode's glyph and name for its switch, then Diagram's and
// Illustrate's Popular tiles, and Draw's own drawing tools in place of the palette. At the mock's
// scale, drawn from the editor's own glyphs where it has them. The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import { lucideChartColumn, lucideChartPie, lucideMessageSquare } from '@livediagram/icons/lucide';
import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';
import {
  FlowchartIcon,
  Glyph,
  IllustrateIcon,
  MarkerIcon,
  Prims,
  type IconProps,
} from '@livediagram/ui';
import type { ComponentType, ReactNode } from 'react';
import { Shape } from './hero-illustration-glyphs';

export type HeroMode = 'diagram' | 'draw' | 'illustrate';

export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  diagram: { label: 'Diagram', Icon: FlowchartIcon },
  draw: { label: 'Draw', Icon: MarkerIcon },
  illustrate: { label: 'Illustrate', Icon: IllustrateIcon },
};

export type Tile = { key: string; label: string; glyph: ReactNode; active?: boolean };

function Lucide({ prims }: { prims: Parameters<typeof Prims>[0]['prims'] }) {
  return (
    <Glyph size={14} units={24}>
      <Prims prims={prims} />
    </Glyph>
  );
}

// A marker in its ink, as the Draw dock shows Marker 1, 2 and 3.
function Marker({ color }: { color: string }) {
  return <MarkerIcon size={14} style={{ color }} />;
}

function SelectGlyph() {
  const select = MODE_GLYPHS.select!;
  return (
    <Glyph size={14} units={select.units}>
      <Prims prims={select.prims} />
    </Glyph>
  );
}

// A donut: the pie's ring with its middle open.
function Donut() {
  return (
    <Glyph size={14} weight={2.2}>
      <circle cx="8" cy="8" r="5" strokeDasharray="20 12" />
    </Glyph>
  );
}

function Eraser() {
  return (
    <Glyph size={14}>
      <path d="M6 13 2.5 9.5l7-7 4 4-6.5 6.5zM5 7l4 4M6 13h7.5" />
    </Glyph>
  );
}

function Highlighter() {
  return (
    <Glyph size={14}>
      <path d="M5 11 3 13h4l1-1M5 11l6-6 2 2-6 6-2-2zM9.5 3.5l3 3" />
    </Glyph>
  );
}

// Diagram's Popular: the first nine of its twelve.
const DIAGRAM_TILES: Tile[] = [
  { key: 'rect', label: 'Square', glyph: <Shape kind="rect" /> },
  { key: 'circle', label: 'Circle', glyph: <Shape kind="circle" /> },
  { key: 'diamond', label: 'Diamond', glyph: <Shape kind="diamond" /> },
  { key: 'text', label: 'Text', glyph: <Shape kind="text" /> },
  { key: 'arrow', label: 'Arrow', glyph: <Shape kind="arrow" /> },
  { key: 'frame', label: 'Frame', glyph: <Shape kind="frame" /> },
  { key: 'note', label: 'Note', glyph: <Shape kind="note" /> },
  { key: 'image', label: 'Image', glyph: <Shape kind="image" /> },
  { key: 'pen', label: 'Shape Pen', glyph: <Shape kind="pen" /> },
];

// Draw's dock: its drawing tools, the blue marker in hand.
const DRAW_TILES: Tile[] = [
  { key: 'select', label: 'Select', glyph: <SelectGlyph /> },
  { key: 'm1', label: 'Marker 1', glyph: <Marker color="#1c1917" /> },
  { key: 'm2', label: 'Marker 2', glyph: <Marker color="#2563eb" />, active: true },
  { key: 'm3', label: 'Marker 3', glyph: <Marker color="#dc2626" /> },
  { key: 'text', label: 'Text', glyph: <Shape kind="text" /> },
  { key: 'note', label: 'Sticky', glyph: <Shape kind="note" /> },
  { key: 'hl', label: 'Highlighter', glyph: <Highlighter /> },
  { key: 'arrow', label: 'Arrow', glyph: <Shape kind="arrow" /> },
  { key: 'eraser', label: 'Eraser', glyph: <Eraser /> },
];

// Illustrate's Popular: the first nine of its twelve.
const ILLUSTRATE_TILES: Tile[] = [
  { key: 'text', label: 'Text', glyph: <Shape kind="text" /> },
  { key: 'rect', label: 'Square', glyph: <Shape kind="rect" /> },
  { key: 'circle', label: 'Circle', glyph: <Shape kind="circle" /> },
  { key: 'image', label: 'Image', glyph: <Shape kind="image" /> },
  { key: 'bubble', label: 'Speech', glyph: <Lucide prims={lucideMessageSquare} /> },
  { key: 'pie', label: 'Pie', glyph: <Lucide prims={lucideChartPie} /> },
  { key: 'bar', label: 'Bar', glyph: <Lucide prims={lucideChartColumn} /> },
  { key: 'donut', label: 'Donut', glyph: <Donut /> },
  { key: 'stat', label: 'Stat Row', glyph: <Shape kind="pill" /> },
];

export const MODE_TILES: Record<HeroMode, Tile[]> = {
  diagram: DIAGRAM_TILES,
  draw: DRAW_TILES,
  illustrate: ILLUSTRATE_TILES,
};
