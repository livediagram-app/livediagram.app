import { describe, expect, it } from 'vitest';
import type { Tab } from '@liveplanner/document';
import { getTheme, themeChartPalette } from './themes';
import { slideThumbFor } from './slide-thumb';

// docs/specs/012-collaboration/presentation-mode.md: a slide's picture is its elements as the canvas draws them.
describe('slideThumbFor', () => {
  it('draws a chart in the tab theme’s colours, as the canvas does, not the built-in ramp', () => {
    const chart = {
      id: 'c',
      type: 'shape',
      shape: 'bar-chart',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      pieSlices: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
        { label: 'C', value: 3 },
      ],
    };
    const charted = { id: 't', name: 'T', elements: [chart] } as unknown as Tab;
    const thumb = slideThumbFor({ id: 's', tabId: 't', elementIds: ['c'] }, charted, {
      iconsLoaded: true,
    })!;
    for (const colour of themeChartPalette(getTheme(undefined)).slice(0, 3))
      expect(thumb.markup).toContain(`fill="${colour}"`);
  });
});
