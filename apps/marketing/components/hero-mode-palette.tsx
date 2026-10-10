// What the hero's Palette strip offers in each editor mode (docs/specs/007-editor/editor-modes.md
// "The palette per mode"): the mode's glyph and name for its switch, then Diagram's and
// Illustrate's Popular tiles, Draw's own drawing tools in place of the palette, and Plan's card types and boards. At the mock's
// scale, drawn from the editor's own glyphs where it has them. The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import {
  lucideChartColumn,
  lucideChartPie,
  lucideListTodo,
  lucideMessageSquare,
  lucideSquareKanban,
  lucideVote,
} from '@livediagram/icons/lucide';
import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';
import { EDITOR_MODE_ICONS, Glyph, MarkerIcon, Prims, type IconProps } from '@livediagram/ui';
import type { ComponentType, ReactNode } from 'react';
import { Shape } from './hero-illustration-glyphs';

export type HeroMode = 'diagram' | 'draw' | 'illustrate' | 'plan';

// Each mode's name and its glyph, the editor's own (EDITOR_MODE_ICONS).
export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  diagram: { label: 'Diagram', Icon: EDITOR_MODE_ICONS.diagram },
  draw: { label: 'Draw', Icon: EDITOR_MODE_ICONS.draw },
  illustrate: { label: 'Illustrate', Icon: EDITOR_MODE_ICONS.illustrate },
  plan: { label: 'Plan', Icon: EDITOR_MODE_ICONS.plan },
};

type Tile = { key: string; glyph: ReactNode; active?: boolean };

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
  { key: 'rect', glyph: <Shape kind="rect" /> },
  { key: 'circle', glyph: <Shape kind="circle" /> },
  { key: 'diamond', glyph: <Shape kind="diamond" /> },
  { key: 'text', glyph: <Shape kind="text" /> },
  { key: 'arrow', glyph: <Shape kind="arrow" /> },
  { key: 'frame', glyph: <Shape kind="frame" /> },
  { key: 'note', glyph: <Shape kind="note" /> },
  { key: 'image', glyph: <Shape kind="image" /> },
  { key: 'pen', glyph: <Shape kind="pen" /> },
];

// Draw's dock: its drawing tools, the blue marker in hand.
const DRAW_TILES: Tile[] = [
  { key: 'select', glyph: <SelectGlyph /> },
  { key: 'm1', glyph: <Marker color="#1c1917" /> },
  { key: 'm2', glyph: <Marker color="#2563eb" />, active: true },
  { key: 'm3', glyph: <Marker color="#dc2626" /> },
  { key: 'text', glyph: <Shape kind="text" /> },
  { key: 'note', glyph: <Shape kind="note" /> },
  { key: 'hl', glyph: <Highlighter /> },
  { key: 'arrow', glyph: <Shape kind="arrow" /> },
  { key: 'eraser', glyph: <Eraser /> },
];

// Illustrate's Popular: the first nine of its twelve.
const ILLUSTRATE_TILES: Tile[] = [
  { key: 'text', glyph: <Shape kind="text" /> },
  { key: 'rect', glyph: <Shape kind="rect" /> },
  { key: 'circle', glyph: <Shape kind="circle" /> },
  { key: 'image', glyph: <Shape kind="image" /> },
  { key: 'bubble', glyph: <Lucide prims={lucideMessageSquare} /> },
  { key: 'pie', glyph: <Lucide prims={lucideChartPie} /> },
  { key: 'bar', glyph: <Lucide prims={lucideChartColumn} /> },
  { key: 'donut', glyph: <Donut /> },
  { key: 'stat', glyph: <Shape kind="pill" /> },
];

// A card type's tile: a card with its type's colour stripe.
function CardTile({ colour }: { colour: string }) {
  return (
    <Glyph size={14}>
      <rect x="2" y="4" width="12" height="8" rx="1.5" />
      <path d="M3.25 4.75v6.5" stroke={colour} strokeWidth="2" />
    </Glyph>
  );
}

// Plan's Cards category (docs/specs/026-plan/plan-mode.md "The palette"): one tile per card type, then the
// boards. Plan has no Popular; its strip opens on Cards.
const PLAN_TILES: Tile[] = [
  { key: 'task', glyph: <CardTile colour="#0ea5e9" />, active: true },
  { key: 'bug', glyph: <CardTile colour="#ef4444" /> },
  { key: 'idea', glyph: <CardTile colour="#f59e0b" /> },
  { key: 'project', glyph: <CardTile colour="#8b5cf6" /> },
  { key: 'kanban', glyph: <Lucide prims={lucideSquareKanban} /> },
  { key: 'list', glyph: <Lucide prims={lucideListTodo} /> },
  { key: 'votes', glyph: <Lucide prims={lucideVote} /> },
];

export const MODE_TILES: Record<HeroMode, Tile[]> = {
  diagram: DIAGRAM_TILES,
  draw: DRAW_TILES,
  illustrate: ILLUSTRATE_TILES,
  plan: PLAN_TILES,
};
