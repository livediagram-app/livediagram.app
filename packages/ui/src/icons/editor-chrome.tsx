import {
  lucideBrushCleaning,
  lucideLayers,
  lucideSlidersHorizontal,
} from '@livediagram/icons/lucide';

import { Glyph, type IconProps } from './Glyph';
import { lucideGlyph } from './lucide-glyph';

// The editor's bottom chrome (docs/specs/004-interface-design/iconography.md): the canvas cluster
// (undo / redo, tidy up, layers, the look-and-feel brush) and the tab bar's settings. Shared
// so the marketing hero's editor mock draws the very same glyphs as the editor it depicts.

export function UndoIcon({ size = 13, ...rest }: IconProps = {}) {
  return (
    <Glyph size={size} units={16} {...rest}>
      <path d="M3.5 6.5h6.75A3.25 3.25 0 0 1 13.5 9.75v0a3.25 3.25 0 0 1-3.25 3.25H6" />
      <path d="M6 3.5L3 6.5L6 9.5" />
    </Glyph>
  );
}

export function RedoIcon({ size = 13, ...rest }: IconProps = {}) {
  return (
    <Glyph size={size} units={16} {...rest}>
      <path d="M12.5 6.5H5.75A3.25 3.25 0 0 0 2.5 9.75v0A3.25 3.25 0 0 0 5.75 13H10" />
      <path d="M10 3.5L13 6.5L10 9.5" />
    </Glyph>
  );
}

// The Theme & canvas button in the bottom-right cluster (docs/specs/011-theme/canvas-and-theme-dialog.md): a
// painter's palette with four paint wells in colour, so it reads as "how this tab looks" at a glance. The wells
// keep their colours in both modes (mid-tone hues that hold contrast on light and dark chrome).
export function ThemeLookIcon({ size = 20, ...rest }: IconProps = {}) {
  return (
    <Glyph size={size} units={24} {...rest}>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r="1.7" fill="#3b82f6" stroke="none" />
      <circle cx="17.5" cy="10.5" r="1.7" fill="#f59e0b" stroke="none" />
      <circle cx="8.5" cy="7.5" r="1.7" fill="#10b981" stroke="none" />
      <circle cx="6.5" cy="12.5" r="1.7" fill="#f43f5e" stroke="none" />
    </Glyph>
  );
}

// The Layers button in the bottom-right cluster (20px).
export const LayersStackIcon = lucideGlyph(lucideLayers, 20);

// The Tidy Up button, left of Layers in Diagram mode (docs/specs/008-canvas/layout-cleanup.md): a broom (20px).
export const TidyUpIcon = lucideGlyph(lucideBrushCleaning, 20);

// Settings: two sliders, never a cog (a cog's spokes read as a sun, the appearance toggle).
export const SettingsIcon = lucideGlyph(lucideSlidersHorizontal, 16);
