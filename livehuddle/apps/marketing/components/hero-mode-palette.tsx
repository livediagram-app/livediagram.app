// What the scenes' Palette strip offers (docs/specs/007-editor/toolbar-layout.md "The category bar"): the meeting
// palette's category bar, each category's glyph and its one-word name, in bands, and the board's glyph for the tab
// pill.
// Keyed by the editor's own EditorMode, so a new mode fails typecheck here. The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import type { EditorMode } from '@livehuddle/document';
import {
  EDITOR_MODE_ICONS,
  lucideGlyph,
  MoveGroupIcon,
  StickersTabIcon,
  WriteTabIcon,
  type IconProps,
} from '@livehuddle/ui';
import {
  lucideArmchair,
  lucideCoffee,
  lucidePanelsTopLeft,
  lucidePresentation,
  lucideTreePine,
  lucideWine,
} from '@liveworkspace/icons/lucide';
import type { ComponentType } from 'react';

export type HeroMode = EditorMode;

// Each mode's name and its glyph, the editor's own (EDITOR_MODE_ICONS).
export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  workshop: { label: 'Space', Icon: EDITOR_MODE_ICONS.workshop },
};

// A category on the bar: its glyph (the editor's own, @livehuddle/ui) and its one-word name.
export type BarCategory = { key: string; label: string; Icon: ComponentType };

// The building categories wear their lucide glyphs, as the editor's bar does (space-categories.tsx).
const glyph = (prims: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(prims, 18);

// Each bar mode's categories, band by band (a hairline between bands), as the editor lays them out: Write · Rooms,
// Seats, Perks, Play, Garden, Meet · Travel · Stickers.
export const MODE_BAR: Record<HeroMode, readonly (readonly BarCategory[])[]> = {
  workshop: [
    [{ key: 'write', label: 'Write', Icon: WriteTabIcon }],
    [
      { key: 'rooms', label: 'Rooms', Icon: glyph(lucidePanelsTopLeft) },
      { key: 'seating', label: 'Seats', Icon: glyph(lucideArmchair) },
      { key: 'amenities', label: 'Perks', Icon: glyph(lucideCoffee) },
      { key: 'recreation', label: 'Play', Icon: glyph(lucideWine) },
      { key: 'garden', label: 'Garden', Icon: glyph(lucideTreePine) },
      { key: 'meeting', label: 'Meet', Icon: glyph(lucidePresentation) },
    ],
    [{ key: 'travel', label: 'Travel', Icon: MoveGroupIcon }],
    [{ key: 'stickers', label: 'Stickers', Icon: StickersTabIcon }],
  ],
};
