// @vitest-environment jsdom
// docs/specs/008-canvas/canvas-and-palette.md "Arrowhead shape": the ER ends on the canvas. Each has a shared
// marker drawn from the export's own glyph, and an arrow whose start has its own end references its own marker there.
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ER_GLYPHS, type ArrowElement } from '@livediagram/document';

const relationship: ArrowElement = {
  id: 'rel',
  type: 'arrow',
  from: { kind: 'free', x: 10, y: 20 },
  to: { kind: 'free', x: 150, y: 20 },
  arrowEnds: 'both',
  arrowheadShape: 'many',
  arrowheadStartShape: 'one',
  strokeColor: '#334155',
};

async function draw(supported: boolean) {
  vi.resetModules();
  vi.stubGlobal('CSS', {
    supports: (p: string, v: string) => supported || !(p === 'fill' && v === 'context-stroke'),
  });
  const { DrawnArrowPreview } = await import('./DrawnArrowPreview');
  const { container } = render(
    <DrawnArrowPreview
      arrow={relationship}
      elementIndex={new Map()}
      occluders={[]}
      draftLayout={() => null}
      withDefs={false}
    />,
  );
  const line = [...container.querySelectorAll('path')].find(
    (p) => p.getAttribute('stroke') === '#334155',
  )!;
  return { container, line };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('ER ends on the canvas', () => {
  it('defines a shared marker per ER end, drawn from the shared glyph', async () => {
    const { ArrowDefs } = await import('./arrow-defs');
    const { container } = render(
      <svg>
        <ArrowDefs />
      </svg>,
    );
    for (const [shape, glyph] of Object.entries(ER_GLYPHS)) {
      const marker = container.querySelector(`marker#arrowhead-${shape}-medium`)!;
      expect(marker).not.toBeNull();
      expect(marker.querySelectorAll('line')).toHaveLength(glyph.lines.length);
      expect(marker.querySelectorAll('circle')).toHaveLength(glyph.rings.length);
    }
  });

  it("references each end's own marker: one at the start, many at the end", async () => {
    const { line } = await draw(true);
    expect(line.getAttribute('marker-start')).toBe('url(#arrowhead-one-medium)');
    expect(line.getAttribute('marker-end')).toBe('url(#arrowhead-many-medium)');
  });

  it('gives each end its own coloured marker where markers cannot take the line colour', async () => {
    const { container, line } = await draw(false);
    expect(line.getAttribute('marker-start')).toBe('url(#arrowhead-rel-start)');
    expect(line.getAttribute('marker-end')).toBe('url(#arrowhead-rel)');
    expect(container.querySelectorAll('marker#arrowhead-rel-start line')).toHaveLength(2);
    expect(container.querySelectorAll('marker#arrowhead-rel line')).toHaveLength(3);
  });
});

// docs/specs/008-canvas/finish.md "Marker": the felt-tip draws an elbow in two layers that alternate at each bend,
// so the head at the far end hangs on whichever layer holds the line's last stroke, never at a bend.
describe('ER ends under the Marker finish', () => {
  const last = (d: string) =>
    d
      .trim()
      .split(/[\s,]+/)
      .filter((t) => /^-?[\d.]+$/.test(t))
      .slice(-2)
      .map(Number);
  const first = (d: string) =>
    d
      .trim()
      .split(/[\s,]+/)
      .filter((t) => /^-?[\d.]+$/.test(t))
      .slice(0, 2)
      .map(Number);

  it.each([
    ['an angled line', { x: 150, y: 120 }],
    ['a straight line', { x: 150, y: 20 }],
  ])('hangs each head at its own end of %s', async (_, to) => {
    vi.resetModules();
    vi.stubGlobal('CSS', { supports: () => true });
    const { DrawnArrowPreview } = await import('./DrawnArrowPreview');
    const { container } = render(
      <DrawnArrowPreview
        arrow={{
          ...relationship,
          to: { kind: 'free', ...to },
          arrowStyle: 'angled',
          finish: 'marker',
          arrowheadShape: 'zero-or-many',
        }}
        elementIndex={new Map()}
        occluders={[]}
        draftLayout={() => null}
        withDefs={false}
      />,
    );
    const ink = [...container.querySelectorAll('path')];
    const starts = ink.filter((p) => p.getAttribute('marker-start'));
    const ends = ink.filter((p) => p.getAttribute('marker-end'));
    expect(starts).toHaveLength(1);
    expect(ends).toHaveLength(1);
    expect(first(starts[0]!.getAttribute('d')!)).toEqual([10, 20]);
    expect(last(ends[0]!.getAttribute('d')!)).toEqual([to.x, to.y]);
  });
});
