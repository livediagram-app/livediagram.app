// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChartLegend } from './ChartLegend';

afterEach(cleanup);

const LONG = 'A very very long slice label that goes on and on forever and ever';

// A name longer than the strip is cut with an ellipsis inside the chart (docs/specs/009-elements/pie-chart.md): each
// row is held to the strip's width, so its name's `truncate` cuts it, rather than the row widening past the chart
// and the strip's overflow clipping its swatch and both ends.
describe('ChartLegend', () => {
  for (const pos of ['bottom', 'right'] as const) {
    it(`holds each row to the strip and truncates its name (${pos})`, () => {
      const { container } = render(
        <ChartLegend
          items={[
            { label: 'A', value: 1 },
            { label: LONG, value: 2 },
          ]}
          colorAt={() => '#000'}
          legend={{ show: true, pos, x: 0, y: 0, w: 120, h: 60 }}
          textColor="#111"
          fontPx={14}
        />,
      );
      const name = [...container.querySelectorAll('span')].find((s) => s.textContent === LONG)!;
      expect(name.className).toContain('truncate');
      expect(name.parentElement!.className.split(' ')).toContain('max-w-full');
    });
  }
});
