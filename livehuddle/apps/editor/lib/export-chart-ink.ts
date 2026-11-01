import type { Tab } from '@livehuddle/document';
import { getTheme, themeChartPalette } from '@/lib/themes';

// What an image export draws its charts in, so they come out as the canvas draws them: the tab
// theme's categorical ramp (the canvas hands its charts the same list, docs/specs/009-elements/
// pie-chart.md).
export function exportChartInk(tab: Pick<Tab, 'theme'>): { chartPalette: readonly string[] } {
  return { chartPalette: themeChartPalette(getTheme(tab.theme)) };
}
