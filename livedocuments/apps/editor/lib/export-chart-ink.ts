import { chartPageGrounds, type LaidOutPage, type Tab } from '@livedocuments/document';
import { getTheme, themeChartPalette } from '@/lib/themes';

// What an image export draws its charts in, so they come out as the canvas draws them: the tab
// theme's categorical ramp (the canvas hands its charts the same list, docs/specs/009-elements/
// pie-chart.md), and, for one page with a fill, what each chart on it sits on, so its
// series and text are adapted as on the canvas (docs/specs/007-editor/pages-mode.md "Charts
// adapt as they are drawn").
export function exportChartInk(
  tab: Pick<Tab, 'theme' | 'elements' | 'layers'>,
  page: LaidOutPage | undefined,
): {
  chartPalette: readonly string[];
  chartGrounds: ReadonlyMap<string, readonly string[]> | undefined;
} {
  return {
    chartPalette: themeChartPalette(getTheme(tab.theme)),
    chartGrounds: page ? chartPageGrounds(tab.elements, [page], tab.layers) : undefined,
  };
}
