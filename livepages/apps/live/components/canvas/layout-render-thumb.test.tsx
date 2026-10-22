// @vitest-environment jsdom

// A logo layout's tile is the layout itself, rendered (docs/specs/007-editor/logo-pages.md "Logo
// layouts"): what pressing it puts on the page.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { layOutPages, newLogoPage, newSlidePage, type Tab } from '@livepages/document';
import { LOGO_LAYOUTS, SLIDE_LAYOUTS } from '@livepages/templates';
import { LayoutRenderThumb, layoutRenderSvg, PAGE_PAPER_DARK } from './layout-render-thumb';
import { LayoutThumb } from './infographic-layout-thumb';

afterEach(() => cleanup());

const [page] = layOutPages([newLogoPage('l')]);
const tab = { id: 't', name: 'T', elements: [], pages: [newLogoPage('l')] } as unknown as Tab;

describe('logo layout tiles', () => {
  it('draw the layout as it lands: its words, framed to the page', () => {
    const svg = layoutRenderSvg(tab, page!, LOGO_LAYOUTS[0]!.id);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Brand');
    expect(svg).toContain(`viewBox="${page!.rect.x} ${page!.rect.y}`);
  });

  it('render as markup sized to the tile, square for the artboard', () => {
    const { container } = render(
      <LayoutRenderThumb layout={LOGO_LAYOUTS[0]!.id} page={page!} width={100} tab={tab} />,
    );
    const tile = container.querySelector<HTMLElement>('[data-layout-render-thumb]')!;
    expect(tile.style.width).toBe('100px');
    expect(tile.style.height).toBe('100px');
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it('fall back to the wireframe outside an editor', () => {
    const { container } = render(<LayoutThumb layout={LOGO_LAYOUTS[0]!.id} page={page!} />);
    expect(container.querySelector('[data-layout-render-thumb]')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('render every logo layout quickly enough for a card of them', () => {
    const t = performance.now();
    for (const l of LOGO_LAYOUTS) layoutRenderSvg(tab, page!, l.id);
    // 25 layouts; a card draws at most 7 at once plus 8 small ones.
    expect(performance.now() - t).toBeLessThan(500);
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
