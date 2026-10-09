'use client';

import { getTheme, themePresetColors } from '@/lib/themes';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { ColourPalette } from '@/components/palette/context-menu-input-rows';

// The Theme Palette every element menu's colour rows offer (docs/specs/008-canvas/
// canvas-and-palette.md Colours, docs/specs/004-interface-design/colour-picker.md): the active
// theme's colours. One hook because there are several menus (the element menu, the multi-selection
// menu, a table cell's own menu) and they must show the SAME colours. Custom colours come from the
// document (useDocumentColours), not from here.
export function useColourPalette(): { swatches: ColourPalette } {
  const { activeTab } = useEditorContext();
  return { swatches: { presets: themePresetColors(getTheme(activeTab?.theme)) } };
}
