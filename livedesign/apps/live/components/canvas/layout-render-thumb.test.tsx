// @vitest-environment jsdom

// A logo layout's tile is the layout itself, rendered (docs/specs/007-editor/logo-pages.md "Logo
// layouts"): what pressing it puts on the page.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  layOutPages,
  newLogoPage,
  newWireframePage,
  pageDeviceClass,
  type Tab,
} from '@livedesign/document';
import { layoutCatalogueFor, LOGO_LAYOUTS } from '@livedesign/templates';
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

// docs/specs/007-editor/pages-mode.md "The layout gallery": a picture-led layout's tile shows a sample
// picture where the layout leaves one; every wireframe layout's tile renders within budget, since the
// gallery can show them all.
describe('layout tiles', () => {
  const [screen] = layOutPages([newWireframePage('s')]);
  const flow = {
    id: 't',
    name: 'T',
    elements: [],
    pages: [newWireframePage('s')],
  } as unknown as Tab;
  const layouts = layoutCatalogueFor('wireframe', pageDeviceClass(screen!)).layouts;

  it('draw a sample picture where the layout leaves one, and none where it leaves none', () => {
    const pages = [{ id: 'p', orientation: 'portrait' as const, size: 'a4' as const }];
    const [page] = layOutPages(pages);
    const poster = { id: 't', name: 'T', elements: [], pages } as unknown as Tab;
    expect(layoutRenderSvg(poster, page!, 'poster')).toContain('data:image/svg+xml');
    expect(layoutRenderSvg(poster, page!, 'big-number')).not.toContain('data:image/svg+xml');
  });

  it('draw a plain page as the viewer sees it: white in light chrome, the dark paper in dark', () => {
    const [page] = layOutPages([{ id: 'p', orientation: 'portrait', size: 'a4' }]);
    const tab = { id: 't', name: 'T', elements: [], pages: [page] } as unknown as Tab;
    expect(layoutRenderSvg(tab, page!, 'big-number', 'light')).not.toContain(PAGE_PAPER_DARK);
    expect(layoutRenderSvg(tab, page!, 'big-number', 'dark')).toContain(PAGE_PAPER_DARK);
  });

  it('render all of them quickly enough for the whole gallery', () => {
    const t = performance.now();
    for (const l of layouts) layoutRenderSvg(flow, screen!, l.id);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});
