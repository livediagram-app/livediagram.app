// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PathEditLayer } from './PathEditLayer';
import { PathDraftLayer } from './PathDraftLayer';

// docs/specs/023-whiteboard/path-tool.md "Editing": corner nodes draw as squares, smooth ones as circles.
describe('PathEditLayer', () => {
  it('draws a corner node as a square and a smooth one as a circle, filling the selected', () => {
    const { container } = render(
      <PathEditLayer
        frame={{ x: 0, y: 0, width: 100, height: 100 }}
        anchors={[
          { x: 0, y: 0, mode: 'corner' },
          {
            x: 50,
            y: 50,
            mode: 'mirrored',
            handleIn: { x: 40, y: 50 },
            handleOut: { x: 60, y: 50 },
          },
          { x: 100, y: 0, mode: 'aligned' },
        ]}
        closed={false}
        selected={new Set([1])}
        box={null}
        guides={null}
        zoom={2}
      />,
    );
    const nodes = [...container.querySelectorAll('[data-path-node]')];
    expect(nodes.map((n) => [n.tagName, n.getAttribute('data-path-node')])).toEqual([
      ['rect', 'corner'],
      ['circle', 'smooth'],
      ['circle', 'smooth'],
    ]);
    // 4 screen px at 200%: 2 canvas px.
    expect(nodes[1]!.getAttribute('r')).toBe('2');
    expect(nodes[1]!.getAttribute('class')).toMatch(/^fill-brand-600/);
    expect(container.querySelectorAll('[data-path-handle]')).toHaveLength(2);
  });
});

describe('the path overlays stay on top (docs/specs/023-whiteboard/path-tool.md "Editing")', () => {
  it('stack above every element, a label being typed included', () => {
    const { container } = render(
      <PathEditLayer
        frame={{ x: 0, y: 0, width: 10, height: 10 }}
        anchors={[
          { x: 0, y: 0, mode: 'corner' },
          { x: 10, y: 10, mode: 'corner' },
        ]}
        closed={false}
        selected={new Set()}
        box={null}
        guides={null}
        zoom={1}
      />,
    );
    const svg = container.querySelector('[data-path-edit]') as SVGElement;
    // Above the selection chrome (30) and an element lifted to type its label (10).
    expect(Number(svg.style.zIndex)).toBeGreaterThan(30);
    const draft = render(
      <PathDraftLayer
        element={null}
        stroke="#000"
        fill="none"
        anchors={[{ x: 0, y: 0, mode: 'corner' }]}
        active={0}
        band={null}
        ring={null}
        zoom={1}
      />,
    ).container.querySelector('[data-path-overlay]') as SVGElement;
    expect(Number(draft.style.zIndex)).toBeGreaterThan(30);
  });
});
