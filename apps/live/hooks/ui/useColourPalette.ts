'use client';

import { getTheme, themePresetColors } from '@/lib/themes';
import { addCustomSwatch, removeCustomSwatch } from '@/lib/custom-swatches';
import { readUserPreferences } from '@/lib/user-preferences';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';
import type { ColourPalette } from '@/components/palette/context-menu-input-rows';

// The colour palette every picker in the editor offers (spec/09 Colours): the
// active theme's presets, plus the colours this user has actually used.
//
// One hook because there are now several pickers (the element menu, the
// multi-selection menu, a table cell's own menu) and they must show the SAME
// palette: a colour you just used on a shape is exactly the colour you want
// on the cell beside it, and a palette that differed per surface would be
// worse than none.
export function useColourPalette(): {
  addCustomColor: (color: string) => void;
  // Ready to spread onto a ColourRow, so no caller has to re-assemble the
  // same four props (and miss one).
  swatches: ColourPalette;
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

  const addCustomColor = (color: string) =>
    update((current) => addCustomSwatch(current, color, presetColors));
  return {
    // Also returned on its own: committing a colour ADDS it to the palette
    // (spec/09 Colours), so callers need it outside the bundle too.
    addCustomColor,
    swatches: {
      presets: presetColors,
      customs: userPreferences.customSwatches ?? [],
      onAddCustom: addCustomColor,
      onRemoveCustom: (color) => update((current) => removeCustomSwatch(current, color)),
    },
  };
}
