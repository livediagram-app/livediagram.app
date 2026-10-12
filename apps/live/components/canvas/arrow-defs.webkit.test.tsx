// @vitest-environment jsdom
// docs/specs/008-canvas/canvas-and-palette.md arrow styles: where the browser cannot paint a shared marker with
// `context-stroke` (WebKit: Safari, every browser on an iPhone or iPad), an arrow's heads would fall back to black,
// lost on a dark canvas. There each arrow carries its own marker, painted its line's colour.
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArrowElement } from '@livediagram/document';

const arrow: ArrowElement = {
  id: 'drawn',
  type: 'arrow',
  from: { kind: 'free', x: 10, y: 20 },
  to: { kind: 'free', x: 150, y: 90 },
  arrowEnds: 'both',
  strokeColor: '#e2e8f0',
};

async function draw(supported: boolean) {
  vi.resetModules();
  vi.stubGlobal('CSS', {
    supports: (p: string, v: string) => supported || !(p === 'fill' && v === 'context-stroke'),
  });
  const { DrawnArrowPreview } = await import('./DrawnArrowPreview');
  const { container } = render(
    <DrawnArrowPreview
      arrow={arrow}
      elementIndex={new Map()}
      occluders={[]}
      draftLayout={() => null}
      withDefs={false}
    />,
  );
  const line = [...container.querySelectorAll('path')].find(
    (p) => p.getAttribute('stroke') === '#e2e8f0',
  )!;
  return { container, line };
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe('arrowheads where markers cannot take the line’s colour', () => {
  it('gives the arrow its own marker, in its line’s colour, at both ends', async () => {
    const { container, line } = await draw(false);
    expect(line.getAttribute('marker-end')).toBe('url(#arrowhead-drawn)');
    expect(line.getAttribute('marker-start')).toBe('url(#arrowhead-drawn)');
    const head = container.querySelector('marker#arrowhead-drawn path')!;
    expect(head.getAttribute('fill')).toBe('#e2e8f0');
  });

  it('keeps the shared markers where context-stroke paints them', async () => {
    const { container, line } = await draw(true);
    expect(line.getAttribute('marker-end')).toMatch(/^url\(#arrowhead-triangle-/);
    expect(container.querySelector('marker#arrowhead-drawn')).toBeNull();
  });
});
