// What the scenes' Palette strip offers in each editor mode (docs/specs/007-editor/editor-modes.md
// "The palette per mode", toolbar-layout.md "The category bar"): the mode's glyph and name for its
// switch, then Diagram's and Workshop's category bars (each category's glyph and its
// one-word name, in bands), Draw's dock in place of the palette, and none for Plan, whose tab brings
// its own bar (hero-plan-bars.tsx). Keyed by the editor's own EditorMode, so a new mode fails typecheck here. At the mock's
// scale, drawn from the editor's own glyphs where it has them. The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import type { EditorMode } from '@livediagram/document';
import { MODE_GLYPHS } from '@livediagram/icons/mode-glyphs';
import {
  AskGroupIcon,
  BehaviourTabIcon,
  BuildTabIcon,
  ConceptsTabIcon,
  DataTabIcon,
  DiagramsTabIcon,
  DrawTabIcon,
  EDITOR_MODE_ICONS,
  Glyph,
  IconsTabIcon,
  MarkerIcon,
  MediaTabIcon,
  Prims,
  ShapesTabIcon,
  StickersTabIcon,
  TechTabIcon,
  WriteTabIcon,
  type IconProps,
} from '@livediagram/ui';
import type { ComponentType, ReactNode } from 'react';
import { Shape } from './hero-illustration-glyphs';

export type HeroMode = EditorMode;

// Each mode's name and its glyph, the editor's own (EDITOR_MODE_ICONS).
export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  diagram: { label: 'Diagram', Icon: EDITOR_MODE_ICONS.diagram },
  draw: { label: 'Draw', Icon: EDITOR_MODE_ICONS.draw },
  workshop: { label: 'Workshop', Icon: EDITOR_MODE_ICONS.workshop },
  plan: { label: 'Plan', Icon: EDITOR_MODE_ICONS.plan },
};

// `hint` is the shortcut the editor prints under the tile; `group` starts a new group in Draw's dock.
export type Tile = {
  key: string;
  glyph: ReactNode;
  active?: boolean;
  hint?: string;
  group?: boolean;
};

// A marker in its ink, as the Draw dock shows Marker 1, 2 and 3.
// The black marker reads as near-white on the dark strip, as the editor lifts dark ink there.
function Marker({ color, className }: { color?: string; className?: string }) {
  return <MarkerIcon size={14} style={color ? { color } : undefined} className={className} />;
}

function SelectGlyph() {
  const select = MODE_GLYPHS.select!;
  return (
    <Glyph size={14} units={select.units}>
      <Prims prims={select.prims} />
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

// Draw's dock: its drawing tools, the blue marker in hand, then its shapes in a group of their own.
const DRAW_TILES: Tile[] = [
  { key: 'select', glyph: <SelectGlyph />, hint: 'V' },
  { key: 'm1', glyph: <Marker className="text-stone-900 dark:text-stone-100" />, hint: '1' },
  { key: 'm2', glyph: <Marker color="#2563eb" />, active: true, hint: '2' },
  { key: 'm3', glyph: <Marker color="#dc2626" />, hint: '3' },
  { key: 'text', glyph: <Shape kind="text" />, hint: 'T' },
  { key: 'hl', glyph: <Highlighter />, hint: 'P' },
  { key: 'eraser', glyph: <Eraser />, hint: 'E' },
  { key: 'arrow', glyph: <Shape kind="arrow" />, hint: 'A', group: true },
  { key: 'rect', glyph: <Shape kind="rect" />, hint: 'R' },
  { key: 'note', glyph: <Shape kind="note" />, hint: 'N' },
];

// Draw's dock, the one mode whose strip is still tiles.
export const DRAW_DOCK: readonly Tile[] = DRAW_TILES;

// A category on the bar: its glyph (the editor's own, @livediagram/ui) and its one-word name.
export type BarCategory = { key: string; label: string; Icon: ComponentType };

// Each bar mode's categories, band by band (a hairline between bands), as the editor lays them out.
// Library joins only while someone has a shape library, so it is not here.
export const MODE_BAR: Partial<Record<HeroMode, readonly (readonly BarCategory[])[]>> = {
  diagram: [
    [
      { key: 'shapes', label: 'Shapes', Icon: ShapesTabIcon },
      { key: 'write', label: 'Write', Icon: WriteTabIcon },
      { key: 'draw', label: 'Draw', Icon: DrawTabIcon },
    ],
    [
      { key: 'diagrams', label: 'Diagrams', Icon: DiagramsTabIcon },
      { key: 'concepts', label: 'Concepts', Icon: ConceptsTabIcon },
      { key: 'layout', label: 'Layout', Icon: BuildTabIcon },
    ],
    [
      { key: 'icons', label: 'Icons', Icon: IconsTabIcon },
      { key: 'tech', label: 'Tech', Icon: TechTabIcon },
      { key: 'media', label: 'Media', Icon: MediaTabIcon },
    ],
  ],
  workshop: [
    [
      { key: 'shapes', label: 'Shapes', Icon: ShapesTabIcon },
      { key: 'write', label: 'Write', Icon: WriteTabIcon },
      { key: 'draw', label: 'Draw', Icon: DrawTabIcon },
    ],
    [
      { key: 'ask', label: 'Ask', Icon: AskGroupIcon },
      { key: 'session', label: 'Session', Icon: BehaviourTabIcon },
    ],
    [
      { key: 'icons', label: 'Icons', Icon: IconsTabIcon },
      { key: 'stickers', label: 'Stickers', Icon: StickersTabIcon },
      { key: 'media', label: 'Media', Icon: MediaTabIcon },
    ],
    [{ key: 'data', label: 'Data', Icon: DataTabIcon }],
  ],
};
