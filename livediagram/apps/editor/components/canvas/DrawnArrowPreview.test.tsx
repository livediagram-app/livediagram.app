// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { arrowheadShapeOf, arrowheadSizeOf, type ArrowElement } from '@livediagram/document';
import { arrowheadMarkerId } from './arrow-defs';
import { DrawnArrowPreview } from './DrawnArrowPreview';

// docs/specs/023-draw-mode/draw-mode.md "Shapes": a line or an arrow previews as exactly the one
// that lands, drawn by the same arrow renderer in the canvas layer.

const arrow = (over: Partial<ArrowElement> = {}): ArrowElement => ({
  id: 'drawn',
  type: 'arrow',
  from: { kind: 'free', x: 10, y: 20 },
  to: { kind: 'free', x: 150, y: 90 },
  arrowEnds: 'to',
  strokeWidth: 6,
  strokeColor: '#1c1917',
  ...over,
});

function preview(a: ArrowElement, withDefs = false) {
  return render(
    <DrawnArrowPreview
      arrow={a}
      elementIndex={new Map()}
      occluders={[]}
      draftLayout={() => null}
      withDefs={withDefs}
    />,
  );
}

// The drawn line: the path in the arrow's own colour.
const lineOf = (c: HTMLElement) =>
  [...c.querySelectorAll('path')].find((p) => p.getAttribute('stroke') === '#1c1917')!;

describe('DrawnArrowPreview', () => {
  it('draws the arrow through the arrow renderer, in canvas coordinates', () => {
    const { container } = preview(arrow());
    const svg = container.querySelector('svg[data-arrow-draw-preview]')!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute('class')).toContain('absolute');
    expect(lineOf(container).getAttribute('d')).toMatch(/^M\s*10[ ,]20/);
  });

  it('draws it as it lands: selected, so release changes no pixel', () => {
    const { container } = preview(arrow());
    // The selected look: the stroke plus half a pixel, over a brand halo.
    expect(lineOf(container).getAttribute('stroke-width')).toBe('6.5');
    expect(container.querySelectorAll('path[stroke-opacity="0.35"]')).toHaveLength(1);
  });

  it('carries the arrowhead marker at its real shape and size', () => {
    const { container } = preview(arrow({ arrowheadSize: 'large' }));
    const line = lineOf(container);
    const a = arrow({ arrowheadSize: 'large' });
    expect(line.getAttribute('marker-end')).toBe(
      `url(#${arrowheadMarkerId(arrowheadShapeOf(a), arrowheadSizeOf(a))})`,
    );
    expect(line.getAttribute('marker-start')).toBeNull();
  });

  it('brings the shared arrowhead defs when the board has no arrow yet', () => {
    const { container } = preview(arrow(), true);
    const id = lineOf(container).getAttribute('marker-end')!.slice(5, -1);
    expect(container.querySelector(`marker[id="${id}"]`)).not.toBeNull();
  });

  it('shows no grips and takes no pointer', () => {
    const { container } = preview(arrow());
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    const svg = container.querySelector('svg[data-arrow-draw-preview]')!;
    expect(svg.getAttribute('class')).toContain('[&_*]:!pointer-events-none');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
});
