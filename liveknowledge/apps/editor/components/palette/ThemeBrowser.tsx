'use client';

import { createThemeBrowser } from '@liveworkspace/workbench/components/palette/ThemeBrowser';
import { getTheme, THEMES } from '@/lib/themes';
import { ThemeCard } from '@/components/palette/theme-picker-cards';

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel"), shared by the editors and bound to
// this one's catalogue. An id that names no theme (a removed custom theme's `custom:<uuid>`) renders as Default.
export const ThemeBrowser = createThemeBrowser({
  themes: THEMES,
  ThemeCard,
  resolveThemeId: (id) => getTheme(id).id,
});
