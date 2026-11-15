// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createShape,
  layOutPages,
  pagesOf,
  pageScreenRect,
  type Page,
  type ScreenLink,
  type ShapeElement,
} from '@livedesign/design';
import { FLOW_STROKE_PX, FlowViewLayer } from './FlowViewLayer';

// docs/specs/007-editor/wireframe-pages.md "Flow view": the arrows, tags and outlines the canvas draws, held in screen
// px, taking no presses.
afterEach(cleanup);

const wire = (id: string): Page => ({
  id,
  orientation: 'portrait',
  kind: 'wireframe',
  device: 'iphone',
});
const pages = layOutPages(pagesOf({ pages: [wire('p1'), wire('p2'), wire('p3')] }));
const linked = (id: string, page: number, link: ScreenLink, y = 120): ShapeElement => {
  const s = pageScreenRect(pages[page]!);
  return { ...createShape('square', s.x + 40, s.y + y), id, link };
};

describe('FlowViewLayer', () => {
  it('draws nothing when nothing is linked', () => {
    const { container } = render(
      <FlowViewLayer elements={[]} layers={undefined} pages={pages} zoom={1} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('draws an arrow per screen link, a Back tag, and a broken stub with its tag', () => {
    const { container } = render(
      <FlowViewLayer
        elements={[
          linked('a', 0, { kind: 'page', pageId: 'p2' }),
          linked('b', 0, { kind: 'page', pageId: 'p3' }, 300),
          linked('c', 1, { kind: 'back' }),
          linked('d', 2, { kind: 'page', pageId: 'gone' }),
        ]}
        layers={undefined}
        pages={pages}
        zoom={0.5}
      />,
    );
    const svg = container.querySelector('svg[data-flow-view]')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('class')).toContain('pointer-events-none');
    const arrows = [...container.querySelectorAll('[data-flow-arrow]')].map((g) =>
      g.getAttribute('data-flow-arrow'),
    );
    expect(arrows).toEqual(['p2', 'p3']);
    // Every arrow ends in the head, its stroke held at 2 screen px.
    const stroke = container.querySelector('[data-flow-arrow] path[marker-end]')!;
    expect(stroke.getAttribute('stroke-width')).toBe(String(FLOW_STROKE_PX / 0.5));
    expect(container.querySelector('marker')?.getAttribute('markerUnits')).toBe('strokeWidth');
    expect(container.querySelector('[data-flow-tag="back"]')?.textContent).toBe('Back');
    const broken = container.querySelector('[data-flow-tag="broken"]')!;
    expect(broken.textContent).toBe('Broken');
    expect((broken as HTMLElement).style.transform).toBe('scale(2)');
    expect(container.querySelector('line[stroke-dasharray]')).not.toBeNull();
    // A box outline for each of the four.
    expect(container.querySelectorAll('svg[data-flow-view] > g > rect')).toHaveLength(4);
  });
});
