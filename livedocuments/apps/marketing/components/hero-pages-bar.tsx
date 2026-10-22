// What the scenes' Palette strip offers (docs/specs/007-editor/toolbar-layout.md "The category bar"):
// Pages' category bar, each category's glyph and its one-word name, in bands, as the editor lays
// them out. Drawn from the editor's own glyphs (@livedocuments/ui). The strip is ToolbarStrip
// (hero-editor-chrome.tsx).

import {
  BuildTabIcon,
  ComponentsTabIcon,
  ConceptsTabIcon,
  DataTabIcon,
  DevicesTabIcon,
  IconsTabIcon,
  MediaTabIcon,
  ShapesTabIcon,
  StickersTabIcon,
  WriteTabIcon,
} from '@livedocuments/ui';
import type { ComponentType } from 'react';

// A category on the bar: its glyph (the editor's own, @livedocuments/ui) and its one-word name.
export type BarCategory = { key: string; label: string; Icon: ComponentType };

// The bar's categories, band by band (a hairline between bands). Logo joins only on a logo page,
// so it is not here.
export const PAGES_BAR: readonly (readonly BarCategory[])[] = [
  [
    { key: 'shapes', label: 'Shapes', Icon: ShapesTabIcon },
    { key: 'write', label: 'Write', Icon: WriteTabIcon },
  ],
  [
    { key: 'build', label: 'Build', Icon: BuildTabIcon },
    { key: 'concepts', label: 'Concepts', Icon: ConceptsTabIcon },
    { key: 'components', label: 'Components', Icon: ComponentsTabIcon },
    { key: 'devices', label: 'Devices', Icon: DevicesTabIcon },
  ],
  [
    { key: 'icons', label: 'Icons', Icon: IconsTabIcon },
    { key: 'stickers', label: 'Stickers', Icon: StickersTabIcon },
    { key: 'media', label: 'Media', Icon: MediaTabIcon },
  ],
  [{ key: 'data', label: 'Data', Icon: DataTabIcon }],
];
