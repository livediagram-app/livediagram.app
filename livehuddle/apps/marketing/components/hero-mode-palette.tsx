// What the scenes' Palette strip offers (docs/specs/007-editor/toolbar-layout.md "The category bar"): the meeting
// palette's category bar, each category's glyph and its one-word name, in bands, and the board's glyph for the tab
// pill.
// Keyed by the editor's own EditorMode, so a new mode fails typecheck here. The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import type { EditorMode } from '@livehuddle/document';
import {
  EDITOR_MODE_ICONS,
  IconsTabIcon,
  lucideGlyph,
  MediaTabIcon,
  ModeGroupIcon,
  MoveGroupIcon,
  ReactionGroupIcon,
  StickersTabIcon,
  WriteTabIcon,
  type IconProps,
} from '@livehuddle/ui';
import { lucidePanelTop } from '@liveworkspace/icons/lucide';
import type { ComponentType } from 'react';

export type HeroMode = EditorMode;

// Each mode's name and its glyph, the editor's own (EDITOR_MODE_ICONS).
export const HERO_MODE: Record<HeroMode, { label: string; Icon: ComponentType<IconProps> }> = {
  workshop: { label: 'Space', Icon: EDITOR_MODE_ICONS.workshop },
};

// A category on the bar: its glyph (the editor's own, @livehuddle/ui) and its one-word name.
export type BarCategory = { key: string; label: string; Icon: ComponentType };

// The Frame category wears the Frame tile's own glyph, as the editor's bar does.
const FrameIcon = lucideGlyph(lucidePanelTop, 18);

// Each bar mode's categories, band by band (a hairline between bands), as the editor lays them out: Write, Frame ·
// Navigate, React, Modes · Icons, Stickers, Media.
export const MODE_BAR: Record<HeroMode, readonly (readonly BarCategory[])[]> = {
  workshop: [
    [
      { key: 'write', label: 'Write', Icon: WriteTabIcon },
      { key: 'frame', label: 'Frame', Icon: FrameIcon },
    ],
    [
      { key: 'navigate', label: 'Navigate', Icon: MoveGroupIcon },
      { key: 'react', label: 'React', Icon: ReactionGroupIcon },
      { key: 'modes', label: 'Modes', Icon: ModeGroupIcon },
    ],
    [
      { key: 'icons', label: 'Icons', Icon: IconsTabIcon },
      { key: 'stickers', label: 'Stickers', Icon: StickersTabIcon },
      { key: 'media', label: 'Media', Icon: MediaTabIcon },
    ],
  ],
};
