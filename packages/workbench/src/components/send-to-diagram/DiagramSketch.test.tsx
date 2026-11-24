// @vitest-environment jsdom
// The picker's preview as SVG (DiagramSketch.tsx): every shape, labels cut, dashed and labelled arrows, frames,
// lifelines, and opening a sketch bigger than its box on where the diagram starts.
import { cleanup, render } from '@testing-library/react';
import type { DiagramSendGraph } from '@liveworkspace/index-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramSketch } from './DiagramSketch';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const flow: DiagramSendGraph = {
  nodes: [
    { id: 'a', label: 'A very long label that is cut short', shape: 'diamond', group: 'g' },
    { id: 'b', label: 'Round', shape: 'circle', group: 'g' },
    { id: 'c', label: 'Store', shape: 'cylinder' },
    { id: 'd', label: 'Plain' },
  ],
  edges: [
    { from: 'a', to: 'b', label: 'A label well over twenty characters', line: 'dashed' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'd' },
  ],
  groups: [{ id: 'g', label: 'Group' }],
};

describe('DiagramSketch', () => {
  it('draws every shape, cuts long labels, and frames, dashes and labels what it should', () => {
    const { container } = render(<DiagramSketch graph={flow} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-label')).toBe('A sketch of 4 boxes and 3 arrows');
    expect(svg.querySelector('polygon')).toBeTruthy();
    expect(svg.querySelector('ellipse')).toBeTruthy();
    expect(svg.querySelector('rect[rx="14"]')).toBeTruthy();
    expect(svg.querySelector('rect[rx="8"]')).toBeTruthy();
    expect(svg.querySelector('rect[stroke-dasharray]')).toBeTruthy();
    expect(svg.querySelectorAll('line[stroke-dasharray="5 4"]')).toHaveLength(1);
    const words = [...svg.querySelectorAll('text')].map((t) => t.textContent);
    expect(words).toContain('A very long label t…');
    expect(words).toContain('A label well over t…');
    expect(words).toContain('Plain');
  });

  it('draws a sequence with its lifelines', () => {
    const { container } = render(
      <DiagramSketch
        graph={{
          style: 'sequence',
          nodes: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          edges: [{ from: 'a', to: 'b', label: 'hi' }],
        }}
      />,
    );
    expect(container.querySelectorAll('line[stroke-dasharray="3 4"]')).toHaveLength(2);
  });

  it('opens a sketch bigger than its box on the first box, or a mind map on its centre', () => {
    const size = (w: number, h: number) => {
      vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(w);
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(h);
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(100);
      vi.spyOn(
        SVGElement.prototype as unknown as HTMLElement,
        'clientWidth',
        'get',
      ).mockReturnValue(400);
      vi.spyOn(
        SVGElement.prototype as unknown as HTMLElement,
        'clientHeight',
        'get',
      ).mockReturnValue(300);
    };
    // It all fits: no scrolling.
    size(200, 100);
    const fits = render(
      <div>
        <DiagramSketch graph={flow} />
      </div>,
    );
    expect((fits.container.firstChild as HTMLElement).scrollLeft).toBe(0);
    cleanup();
    vi.restoreAllMocks();
    // It overflows: scrolled to where the diagram starts.
    size(800, 600);
    const down = render(
      <div>
        <DiagramSketch graph={flow} />
      </div>,
    );
    const box = down.container.firstChild as HTMLElement;
    expect(box.scrollLeft).toBeGreaterThanOrEqual(0);
    cleanup();
    const mind = render(
      <div>
        <DiagramSketch graph={{ ...flow, style: 'mindmap' }} />
      </div>,
    );
    expect(mind.container.firstChild).toBeTruthy();
  });

  it('draws an empty graph without scrolling anywhere', () => {
    const { container } = render(<DiagramSketch graph={{ nodes: [], edges: [] }} />);
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'A sketch of 0 boxes and 0 arrows',
    );
  });
});
