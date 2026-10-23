// @vitest-environment jsdom

// A layout's tile is the layout itself, rendered (docs/specs/007-editor/pages-mode.md "The layout
// gallery"): what pressing it puts on the page.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { layOutPages, newSlidePage, type Tab } from '@livedocuments/document';
import { SLIDE_LAYOUTS } from '@livedocuments/templates';
import { LayoutRenderThumb, layoutRenderSvg, PAGE_PAPER_DARK } from './layout-render-thumb';
import { LayoutThumb } from './infographic-layout-thumb';

afterEach(() => cleanup());

describe('layout tiles', () => {
  const [page] = layOutPages([newSlidePage('s', 'slide')]);
  const tab = {
    id: 't',
    name: 'T',
    elements: [],
    pages: [newSlidePage('s', 'slide')],
  } as unknown as Tab;

  it('draw the layout as it lands, framed to the page', () => {
    const svg = layoutRenderSvg(tab, page!, 'slide-bullets');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(`viewBox="${page!.rect.x} ${page!.rect.y}`);
  });

  it('render as markup sized to the tile, in the page’s shape', () => {
    const { container } = render(
      <LayoutRenderThumb layout="slide-bullets" page={page!} width={160} tab={tab} />,
    );
    const tile = container.querySelector<HTMLElement>('[data-layout-render-thumb]')!;
    expect(tile.style.width).toBe('160px');
    expect(tile.style.height).toBe('90px');
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it('fall back to the outline outside an editor', () => {
    const { container } = render(<LayoutThumb layout="slide-bullets" page={page!} />);
    expect(container.querySelector('[data-layout-render-thumb]')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

// docs/specs/007-editor/pages-mode.md "The layout gallery": a picture-led slide layout's tile shows a
// sample picture where the layout leaves one; every slide layout's tile renders within budget,
// since the gallery can show them all.
describe('slide layout tiles', () => {
  const [slide] = layOutPages([newSlidePage('s', 'slide')]);
  const deck = {
    id: 't',
    name: 'T',
    elements: [],
    pages: [newSlidePage('s', 'slide')],
  } as unknown as Tab;

  it('draw a sample picture where the layout leaves one, and none where it leaves none', () => {
    expect(layoutRenderSvg(deck, slide!, 'slide-split-image-right')).toContain(
      'data:image/svg+xml',
    );
    expect(layoutRenderSvg(deck, slide!, 'slide-bullets')).not.toContain('data:image/svg+xml');
  });

  it('draw a plain page as the viewer sees it: white in light chrome, the dark paper in dark', () => {
    const light = layoutRenderSvg(deck, slide!, 'slide-bullets', 'light');
    const dark = layoutRenderSvg(deck, slide!, 'slide-bullets', 'dark');
    expect(light).not.toContain(PAGE_PAPER_DARK);
    expect(dark).toContain(PAGE_PAPER_DARK);
  });

  it('render all sixty-one quickly enough for the whole gallery', () => {
    const t = performance.now();
    for (const l of SLIDE_LAYOUTS) layoutRenderSvg(deck, slide!, l.id);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});
