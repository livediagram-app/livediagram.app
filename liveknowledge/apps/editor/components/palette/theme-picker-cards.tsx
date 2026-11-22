import { createThemeCard } from '@liveworkspace/workbench/components/palette/theme-picker-cards';
import type { ThemeDefinition } from '@/lib/themes';
import { themeDescription } from '@liveworkspace/workbench/lib/themes-taxonomy';
import { ThemeSwatch } from '@/components/primitives/ThemeSwatch';

// The card for the flat theme list (ThemeBrowser), shared by the editors and drawn with this one's swatch.
export const ThemeCard = createThemeCard<ThemeDefinition>({ ThemeSwatch, themeDescription });
