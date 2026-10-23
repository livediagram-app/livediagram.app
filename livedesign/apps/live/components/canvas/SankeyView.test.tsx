// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { setSankeyTourFocus } from '@/lib/sankey-tour-focus';
import { createShape, type ShapeElement } from '@livedesign/design';
import { SankeyView } from './SankeyView';

// The Sankey on the canvas (docs/specs/009-elements/sankey.md): the shared frame drawn, plus hover.
const el = (extra: Partial<ShapeElement> = {}) =>
  ({ ...createShape('sankey', 0, 0), id: 's', ...extra }) as ShapeElement;

describe('SankeyView', () => {
  it('draws the starter budget with a summary for screen readers', () => {
    const { container } = render(<SankeyView element={el()} textColor="#0f172a" editable />);
    expect(container.querySelector('svg[role="img"]')!.getAttribute('aria-label')).toContain(
      '7 flows between 8 nodes',
    );
    expect(container.textContent).toContain('Groceries');
    expect(container.querySelectorAll('linearGradient')).toHaveLength(7);
  });

  it('reads a hovered band, and a hovered node', () => {
    const { container } = render(<SankeyView element={el()} textColor="#0f172a" editable />);
    // The hover targets come last: seven bands, then eight nodes.
    const hits = container.querySelectorAll('[stroke="transparent"]');
    fireEvent.pointerEnter(hits[0]!);
    expect(container.textContent).toContain('Salary → Budget: 3,200 · 100% of Salary');
    fireEvent.pointerLeave(hits[0]!);
    const nodeHits = container.querySelectorAll('rect[fill="transparent"]');
    fireEvent.pointerEnter(nodeHits[1]!);
    expect(container.textContent).toContain('Budget: In 4,000 · Out 4,000');
  });

  it('tells an Editor how to add flows, and anyone else only that there are none', () => {
    const empty = el({ sankeyFlows: [] });
    expect(
      render(<SankeyView element={empty} textColor="#000" editable />).container.textContent,
    ).toBe('No flows yet. Double-click to add flows.');
    expect(
      render(<SankeyView element={empty} textColor="#000" editable={false} />).container
        .textContent,
    ).toBe('No flows yet');
  });

  it('runs a current along the bands only for the Flow animation', () => {
    const still = render(<SankeyView element={el()} textColor="#000" editable />).container;
    expect(still.querySelectorAll('.lvd-sankey-current')).toHaveLength(0);
    const flowing = render(
      <SankeyView element={el({ sankeyAnim: 'flow' })} textColor="#000" editable />,
    ).container;
    expect(flowing.querySelectorAll('.lvd-sankey-current')).toHaveLength(7);
  });

  it('staggers Cascade, Pulse and Rise by column, left to right, and only them', () => {
    for (const anim of ['cascade', 'pulse', 'rise'] as const) {
      const { container, unmount } = render(
        <SankeyView element={el({ sankeyAnim: anim })} textColor="#000" editable />,
      );
      expect(container.querySelector('svg')!.getAttribute('class')).toContain(`lvd-sankey-${anim}`);
      const cols = [...container.querySelectorAll<SVGElement>('.lvd-sk-node')].map((n) =>
        n.style.getPropertyValue('--lvd-sk-col'),
      );
      // The starter budget runs four columns: Salary and Side Work, Budget, Needs, then the ends.
      expect(new Set(cols)).toEqual(new Set(['0', '1', '2', '3']));
      unmount();
    }
    const { container } = render(
      <SankeyView element={el({ sankeyAnim: 'grow' })} textColor="#000" editable />,
    );
    expect(
      container.querySelector<SVGElement>('.lvd-sk-node')!.style.getPropertyValue('--lvd-sk-col'),
    ).toBe('');
  });
});

// The Sankey tour lifts a part as a hover would (docs/specs/007-editor/element-tours.md "The Sankey tour").
describe('SankeyView tour lift', () => {
  afterEach(() => act(() => setSankeyTourFocus(null)));

  it('reads the lifted band or node on the canvas, over a pointer resting elsewhere', () => {
    const { container } = render(
      <SankeyView element={el()} textColor="#0f172a" editable onCanvas />,
    );
    act(() => setSankeyTourFocus({ elementId: 's', part: 'band', index: 0 }));
    expect(container.textContent).toContain('Salary → Budget: 3,200');
    act(() => setSankeyTourFocus({ elementId: 's', part: 'node', index: 1 }));
    expect(container.textContent).toContain('Budget: In 4,000 · Out 4,000');
    const hits = container.querySelectorAll('[stroke="transparent"]');
    fireEvent.pointerEnter(hits[0]!);
    expect(container.textContent).toContain('Budget: In 4,000');
    expect(container.textContent).not.toContain('Salary → Budget:');
    // The step over, the pointer's hover reads again.
    act(() => setSankeyTourFocus(null));
    expect(container.textContent).toContain('Salary → Budget:');
    fireEvent.pointerLeave(hits[0]!);
    expect(container.textContent).not.toContain('Salary → Budget:');
  });

  it('marks its parts for the tour to point at', () => {
    const { container } = render(<SankeyView element={el()} textColor="#000" editable onCanvas />);
    expect(container.querySelectorAll('[data-sankey-band]')).toHaveLength(7);
    expect(container.querySelectorAll('[data-sankey-node]')).toHaveLength(8);
  });

  it('ignores a lift off the canvas, for another diagram, or past its parts', () => {
    const preview = render(<SankeyView element={el()} textColor="#000" editable={false} />);
    act(() => setSankeyTourFocus({ elementId: 's', part: 'band', index: 0 }));
    expect(preview.container.textContent).not.toContain('Salary → Budget:');
    preview.unmount();
    const other = render(
      <SankeyView element={el({ id: 'x' })} textColor="#000" editable onCanvas />,
    );
    expect(other.container.textContent).not.toContain('Salary → Budget:');
    other.unmount();
    const { container } = render(<SankeyView element={el()} textColor="#000" editable onCanvas />);
    act(() => setSankeyTourFocus({ elementId: 's', part: 'band', index: 99 }));
    expect(container.textContent).not.toContain('→');
  });
});
