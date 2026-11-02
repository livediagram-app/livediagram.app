// What the scenes' Palette strip offers (docs/specs/007-editor/toolbar-layout.md "The category bar"): Workshop's
// category bar, each category's glyph and its one-word name, in bands, and Workshop's glyph for the tab pill.
// Keyed by the editor's own EditorMode, so a new mode fails typecheck here. The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import type { EditorMode } from '@livehuddle/document';
import {
  AskGroupIcon,
  BehaviourTabIcon,
  DataTabIcon,
  DrawTabIcon,
  EDITOR_MODE_ICONS,
  IconsTabIcon,
  MediaTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  WriteTabIcon,
  type IconProps,
} from '@livehuddle/ui';
import type { ComponentType } from 'react';

export type HeroMode = EditorMode;

// Each mode's name and its glyph, the editor's own (EDITOR_MODE_ICONS).
export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  workshop: { label: 'Workshop', Icon: EDITOR_MODE_ICONS.workshop },
};

// A category on the bar: its glyph (the editor's own, @livehuddle/ui) and its one-word name.
export type BarCategory = { key: string; label: string; Icon: ComponentType };

// Each bar mode's categories, band by band (a hairline between bands), as the editor lays them out.
// Library joins only while someone has a shape library, so it is not here.
export const MODE_BAR: Record<HeroMode, readonly (readonly BarCategory[])[]> = {
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
