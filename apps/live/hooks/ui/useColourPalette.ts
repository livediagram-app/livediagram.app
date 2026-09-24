'use client';

import { getTheme, themePresetColors } from '@/lib/themes';
import { addCustomSwatch, removeCustomSwatch } from '@/lib/custom-swatches';
import { readUserPreferences } from '@/lib/user-preferences';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';

// The colour palette every picker in the editor offers (spec/09 Colours): the
// active theme's presets, plus the colours this user has actually used.
//
// One hook because there are now several pickers (the element menu, the
// multi-selection menu, a table cell's own menu) and they must show the SAME
// palette: a colour you just used on a shape is exactly the colour you want
// on the cell beside it, and a palette that differed per surface would be
// worse than none.
export function useColourPalette(): {
  presetColors: string[];
  customColors: string[];
  addCustomColor: (color: string) => void;
  removeCustomColor: (color: string) => void;
} {
  const { activeTab, userPreferences, setUserPreferences, writeUserPreferences, selfParticipant } =
    useEditorContext();
  const presetColors = themePresetColors(getTheme(activeTab?.theme));

  // Written off the FRESHEST stored preferences rather than this render's
  // snapshot: writeUserPreferences PUTs the whole blob, so a stale base would
  // wipe preferences changed elsewhere since this menu opened.
  const update = (next: (current: string[] | undefined) => string[]) => {
    const latest = readUserPreferences();
    const merged = { ...latest, customSwatches: next(latest.customSwatches) };
    setUserPreferences(merged);
    writeUserPreferences(merged, selfParticipant?.id ?? null);
  };

  return {
    presetColors,
    customColors: userPreferences.customSwatches ?? [],
    addCustomColor: (color) => update((current) => addCustomSwatch(current, color, presetColors)),
    removeCustomColor: (color) => update((current) => removeCustomSwatch(current, color)),
  };
}
