import { lucideLayers, lucideSlidersHorizontal } from '@livediagram/icons/lucide';

import { Glyph, type IconProps } from './Glyph';
import { lucideGlyph } from './lucide-glyph';

// The editor's bottom chrome (docs/specs/004-interface-design/iconography.md): the canvas cluster
// (tab activity, undo / redo, layers, the look-and-feel brush) and the tab bar's settings. Shared
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

// Tab activity: a clock with a rewind arrow.
export function ActivityIcon({ size = 20, ...rest }: IconProps = {}) {
  return (
    <Glyph size={size} units={20} {...rest}>
      <path d="M3.5 6.5A6.5 6.5 0 1 1 3 10.5" />
      <path d="M3 3.5V6.5H6" />
      <path d="M10 6.5V10.5L12.75 12" />
    </Glyph>
  );
}

// The Tab Look & Feel brush.
export function ThemeBrushIcon({ size = 20, ...rest }: IconProps = {}) {
  return (
    <Glyph size={size} units={20} {...rest}>
      <path d="M17 3c-3 1-6.4 3.6-8.3 6.1l2.2 2.2C13.4 9.4 16 6 17 3z" />
      <path d="M8.7 9.1 6.5 11.3" />
      <path d="M8 13.4a2.6 2.6 0 1 1-3.7-2.3c.8-.4 1.9-.2 2.6.5.7.7.9 1.3 1.1 1.8z" />
    </Glyph>
  );
}

// The Layers button in the bottom-right cluster (20px).
export const LayersStackIcon = lucideGlyph(lucideLayers, 20);

// Settings: two sliders, never a cog (a cog's spokes read as a sun, the appearance toggle).
export const SettingsIcon = lucideGlyph(lucideSlidersHorizontal, 16);
