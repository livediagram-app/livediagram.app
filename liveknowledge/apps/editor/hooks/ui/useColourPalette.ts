'use client';

import { getTheme, themePresetColors } from '@/lib/themes';
import { useKnowledgeStyle } from '@/lib/knowledge-style/knowledge-style-store';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import type { ColourPalette } from '@/components/palette/context-menu-input-rows';

// The Theme Palette every element menu's colour rows offer (docs/specs/008-canvas/
// canvas-and-palette.md Colours, docs/specs/004-interface-design/colour-picker.md): the active
// theme's colours. One hook because there are several menus (the element menu, the multi-selection
// menu, a table cell's own menu) and they must show the SAME colours. Custom colours come from the
// document (useDocumentColours), not from here.
export function useColourPalette(): { swatches: ColourPalette } {
  const { documentId } = useEditorContext();
  // The knowledgebase's theme: a tab has none of its own (page-surface.md "Knowledgebase Style").
  const themeId = useKnowledgeStyle(documentId).theme;
  return { swatches: { presets: themePresetColors(getTheme(themeId)) } };
}
