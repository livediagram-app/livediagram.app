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
import {
  FLOW_TAG_GLYPH_GAP_PX,
  FLOW_TAG_GLYPH_PX,
  FLOW_TAG_HEIGHT_PX,
  FLOW_TAG_LABEL,
  FLOW_TAG_LINE_PX,
  FLOW_TAG_PAD_X_PX,
  FLOW_TAG_PAD_Y_PX,
  FLOW_TAG_RING_PX,
  FLOW_TAG_TEXT_PX,
  FLOW_TAG_WIDTH_PX,
} from '@/lib/flow-view';
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

  it('runs a tag leftwards from its anchor where an arc rises past its right', () => {
    const s = pageScreenRect(pages[0]!);
    const edge: ShapeElement = {
      ...linked('x', 0, { kind: 'page', pageId: 'gone' }),
      x: s.x + s.width - 30,
      width: 20,
      height: 20,
    };
    const { container } = render(
      <FlowViewLayer
        elements={[edge, linked('a', 0, { kind: 'page', pageId: 'p3' }, 600)]}
        layers={undefined}
        pages={pages}
        zoom={1}
      />,
    );
    const tag = container.querySelector('[data-flow-tag="broken"]')!;
    expect(tag.getAttribute('data-flow-tag-side')).toBe('left');
    expect(tag.firstElementChild!.className).toContain('-translate-x-full');
  });

  it('draws its tags from the parts the geometry sizes them by, so the two never drift', () => {
    const { container } = render(
      <FlowViewLayer
        elements={[
          linked('c', 1, { kind: 'back' }),
          linked('d', 2, { kind: 'page', pageId: 'gone' }),
        ]}
        layers={undefined}
        pages={pages}
        zoom={1}
      />,
    );
    // Tailwind's spacing step is 4 px; text-xs sets a 16 px line.
    const px = (classes: string[], prefix: string) => {
      const token = classes.find((c) => c.startsWith(prefix));
      return token ? Number(token.slice(prefix.length)) * 4 : NaN;
    };
    for (const kind of ['back', 'broken'] as const) {
      const pill = container.querySelector(`[data-flow-tag="${kind}"]`)!.firstElementChild!;
      const classes = pill.className.split(/\s+/);
      expect(px(classes, 'px-')).toBe(FLOW_TAG_PAD_X_PX);
      expect(px(classes, 'py-')).toBe(FLOW_TAG_PAD_Y_PX);
      expect(px(classes, 'gap-')).toBe(FLOW_TAG_GLYPH_GAP_PX);
      expect(classes).toContain('text-xs');
      expect(FLOW_TAG_LINE_PX).toBe(16);
      expect(classes).toContain('font-semibold');
      expect(classes).toContain(`ring-${FLOW_TAG_RING_PX}`);
      expect(pill.querySelector('svg')!.getAttribute('width')).toBe(String(FLOW_TAG_GLYPH_PX));
      expect(pill.textContent).toBe(FLOW_TAG_LABEL[kind]);
      expect(FLOW_TAG_WIDTH_PX[kind]).toBe(
        2 * FLOW_TAG_PAD_X_PX + FLOW_TAG_GLYPH_PX + FLOW_TAG_GLYPH_GAP_PX + FLOW_TAG_TEXT_PX[kind],
      );
    }
    // The widths measured in the browser (2026-11-18): Back 61.0, Broken 73.4; 20 px tall inside its ring.
    expect(FLOW_TAG_WIDTH_PX).toEqual({ back: 62, broken: 74 });
    expect(FLOW_TAG_HEIGHT_PX).toBe(22);
  });
});
