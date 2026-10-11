// What the hero's Palette strip offers in each editor mode (docs/specs/007-editor/editor-modes.md
// "The palette per mode"): the mode's glyph and name for its switch, then Diagram's, Illustrate's
// and Facilitate's Popular tiles with their shortcuts, Draw's dock in place of the palette, and
// none for Plan, whose board brings its own bar. Keyed by the editor's own EditorMode, so a new mode fails typecheck here. At the mock's
// scale, drawn from the editor's own glyphs where it has them. The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import type { EditorMode } from '@livediagram/document';
import {
  lucideChartColumn,
  lucideChartPie,
  lucideEyeOff,
  lucideListOrdered,
  lucideMessageSquare,
  lucideTimer,
  lucideVote,
} from '@livediagram/icons/lucide';
import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';
import { EDITOR_MODE_ICONS, Glyph, MarkerIcon, Prims, type IconProps } from '@livediagram/ui';
import type { ComponentType, ReactNode } from 'react';
import { Shape } from './hero-illustration-glyphs';

export type HeroMode = EditorMode;

// Each mode's name and its glyph, the editor's own (EDITOR_MODE_ICONS).
export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  diagram: { label: 'Diagram', Icon: EDITOR_MODE_ICONS.diagram },
  draw: { label: 'Draw', Icon: EDITOR_MODE_ICONS.draw },
  facilitate: { label: 'Facilitate', Icon: EDITOR_MODE_ICONS.facilitate },
  illustrate: { label: 'Illustrate', Icon: EDITOR_MODE_ICONS.illustrate },
  plan: { label: 'Plan', Icon: EDITOR_MODE_ICONS.plan },
};

// `hint` is the shortcut the editor prints under the tile; `group` starts a new group in Draw's dock.
export type Tile = { key: string; glyph: ReactNode; active?: boolean; hint?: string; group?: boolean };

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
  { key: 'rect', glyph: <Shape kind="rect" />, hint: 'R' },
  { key: 'circle', glyph: <Shape kind="circle" />, hint: 'O' },
  { key: 'diamond', glyph: <Shape kind="diamond" />, hint: 'D' },
  { key: 'text', glyph: <Shape kind="text" />, hint: 'T' },
  { key: 'arrow', glyph: <Shape kind="arrow" />, hint: 'A' },
  { key: 'frame', glyph: <Shape kind="frame" />, hint: 'F' },
  { key: 'note', glyph: <Shape kind="note" />, hint: 'N' },
  { key: 'image', glyph: <Shape kind="image" />, hint: '9' },
  { key: 'pen', glyph: <Shape kind="pen" />, hint: '6' },
];

// Draw's dock: its drawing tools, the blue marker in hand, then its shapes in a group of their own.
const DRAW_TILES: Tile[] = [
  { key: 'select', glyph: <SelectGlyph />, hint: 'V' },
  { key: 'm1', glyph: <Marker color="#1c1917" />, hint: '1' },
  { key: 'm2', glyph: <Marker color="#2563eb" />, active: true, hint: '2' },
  { key: 'm3', glyph: <Marker color="#dc2626" />, hint: '3' },
  { key: 'text', glyph: <Shape kind="text" />, hint: 'T' },
  { key: 'hl', glyph: <Highlighter />, hint: 'P' },
  { key: 'eraser', glyph: <Eraser />, hint: 'E' },
  { key: 'arrow', glyph: <Shape kind="arrow" />, hint: 'A', group: true },
  { key: 'rect', glyph: <Shape kind="rect" />, hint: 'R' },
  { key: 'note', glyph: <Shape kind="note" />, hint: 'N' },
];

// Illustrate's Popular: the first nine of its twelve.
const ILLUSTRATE_TILES: Tile[] = [
  { key: 'text', glyph: <Shape kind="text" />, hint: 'T' },
  { key: 'rect', glyph: <Shape kind="rect" />, hint: 'R' },
  { key: 'circle', glyph: <Shape kind="circle" />, hint: 'O' },
  { key: 'image', glyph: <Shape kind="image" />, hint: '9' },
  { key: 'bubble', glyph: <Lucide prims={lucideMessageSquare} /> },
  { key: 'pie', glyph: <Lucide prims={lucideChartPie} /> },
  { key: 'bar', glyph: <Lucide prims={lucideChartColumn} /> },
  { key: 'donut', glyph: <Donut /> },
  { key: 'stat', glyph: <Shape kind="pill" /> },
];

// Facilitate's Popular (docs/specs/012-collaboration/facilitate-mode.md "The palette"): the first nine
// of its twelve, a session's notes and the buttons that run the room.
const FACILITATE_TILES: Tile[] = [
  { key: 'sticky', glyph: <Shape kind="note" />, hint: 'N' },
  { key: 'text', glyph: <Shape kind="text" />, hint: 'T' },
  { key: 'frame', glyph: <Shape kind="frame" />, hint: 'F' },
  { key: 'arrow', glyph: <Shape kind="arrow" />, hint: 'A' },
  { key: 'timer', glyph: <Lucide prims={lucideTimer} /> },
  { key: 'vote', glyph: <Lucide prims={lucideVote} /> },
  { key: 'poll', glyph: <Lucide prims={lucideChartColumn} /> },
  { key: 'reveal', glyph: <Lucide prims={lucideEyeOff} /> },
  { key: 'agenda', glyph: <Lucide prims={lucideListOrdered} /> },
];

export const MODE_TILES: Record<HeroMode, Tile[]> = {
  diagram: DIAGRAM_TILES,
  draw: DRAW_TILES,
  illustrate: ILLUSTRATE_TILES,
  // A Plan board fills its tab, so the strip gives way to the board's own bar (PlanBoardBar).
  plan: [],
  facilitate: FACILITATE_TILES,
};
