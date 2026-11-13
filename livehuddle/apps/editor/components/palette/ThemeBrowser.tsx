'use client';

import { createThemeBrowser } from '@liveworkspace/workbench/components/palette/ThemeBrowser';
import { THEMES } from '@/lib/themes';
import { ThemeCard } from '@/components/palette/theme-picker-cards';

// The theme list (docs/specs/011-theme/canvas-and-theme-dialog.md "Colours panel"), shared by the editors and bound to
// this one's catalogue.
export const ThemeBrowser = createThemeBrowser({ themes: THEMES, ThemeCard });
