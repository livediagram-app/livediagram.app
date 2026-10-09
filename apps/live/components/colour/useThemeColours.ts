'use client';

// The Theme Palette of every picker in the editor (docs/specs/004-interface-design/colour-picker.md "The
// colours"): the active tab's theme colours, named by colour words. The same colours the element menu's colour
// rows offer (useColourPalette), so a Plan card, a Draw marker and a shape all open on one Theme Palette.
import { useContext, useMemo } from 'react';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { getTheme, themePresetColors } from '@/lib/themes';
import { themeOptions, type ColourOption } from './colour-options';

const NONE: readonly ColourOption[] = [];

export function useThemeColours(): readonly ColourOption[] {
  // Outside the editor (the Explorer's theme builder, a test) there is no active tab, so no group.
  const editor = useContext(EditorContext);
  const inEditor = editor !== null;
  const themeId = editor?.activeTab?.theme;
  return useMemo(() => {
    if (!inEditor) return NONE;
    return themeOptions(themePresetColors(getTheme(themeId)));
  }, [inEditor, themeId]);
}
