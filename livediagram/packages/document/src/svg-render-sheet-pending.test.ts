// A chart meant to come from a sheet and not linked yet (docs/specs/009-elements/pie-chart.md "Not linked yet", Work
// Tracker 1281) in this product's export: its marks faded under a chip that says so, every chart kind; a linked or
// plain chart drawn as it always was.
import { describe, expect, it } from 'vitest';
import type { ShapeElement, Tab } from './index';
import { renderElementsToSvg } from './svg-render';

const chart = (shape: string, o: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'c1',
  type: 'shape',
  shape,
  x: 0,
  y: 0,
  width: 320,
  height: 200,
  pieSlices: [
    { label: 'Nov', value: 6 },
    { label: 'Dec', value: 9 },
  ],
  ...o,
});

const svgOf = (el: ShapeElement) =>
  renderElementsToSvg({ id: 't', name: 'T', elements: [el] } as Tab, { padding: 0 });

describe('a chart not linked to a sheet yet, exported', () => {
  it.each(['bar-chart', 'pie-chart', 'line-chart'])(
    'fades a %s under the chip and says so',
    (shape) => {
      const svg = svgOf(chart(shape, { chartSheetPending: true }));
      expect(svg).toContain('<g opacity="0.3">');
      expect(svg).toContain('data-sheet-pending');
      expect(svg).toContain('Not linked to a sheet yet');
    },
  );

  it('says the short words on a narrow chart, and only fades one too small for them', () => {
    const narrow = svgOf(chart('bar-chart', { chartSheetPending: true, width: 120 }));
    expect(narrow).toContain('>Not linked yet<');
    const tiny = svgOf(chart('bar-chart', { chartSheetPending: true, width: 40, height: 20 }));
    expect(tiny).toContain('<g opacity="0.3">');
    expect(tiny).not.toContain('data-sheet-pending');
  });

  it('draws a chart without the mark as it always was', () => {
    for (const el of [chart('bar-chart'), chart('bar-chart', { chartSheetPending: false })]) {
      const svg = svgOf(el);
      expect(svg).not.toContain('<g opacity="0.3">');
      expect(svg).not.toContain('Not linked');
    }
  });
});
