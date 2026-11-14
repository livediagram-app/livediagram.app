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
  type Element,
  type Tab,
} from '@livedesign/design';
import { buildPageLayout, layoutCatalogueFor, LOGO_LAYOUTS } from '@livedesign/templates';
import { createStockColourProjector, plainPaper } from '@/lib/stock-colour-projector';
import { themeViewMap } from '@/lib/themes';
import { LayoutRenderThumb, layoutRenderSvg, PAGE_PAPER_DARK } from './layout-render-thumb';
import { LayoutThumb } from './layout-thumb';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';

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
    const t = cpuNowMs();
    for (const l of LOGO_LAYOUTS) layoutRenderSvg(tab, page!, l.id);
    // 25 layouts; a card draws at most 7 at once plus 8 small ones.
    expect(cpuNowMs() - t).toBeLessThan(cpuBudgetMs(500));
  });
});

// docs/specs/007-editor/pages-mode.md "The layout gallery": every wireframe layout's tile renders within
// budget, since the gallery can show them all.
describe('layout tiles', () => {
  const [screen] = layOutPages([newWireframePage('s')]);
  const flow = {
    id: 't',
    name: 'T',
    elements: [],
    pages: [newWireframePage('s')],
  } as unknown as Tab;
  const layouts = layoutCatalogueFor('wireframe', pageDeviceClass(screen!)).layouts;

  it('draw a plain page as the viewer sees it: white in light chrome, the dark paper in dark', () => {
    const [logo] = layOutPages([newLogoPage('l')]);
    const tab = { ...flow, pages: [logo] } as unknown as Tab;
    expect(layoutRenderSvg(tab, logo!, 'logo-stacked', 'light')).not.toContain(PAGE_PAPER_DARK);
    expect(layoutRenderSvg(tab, logo!, 'logo-stacked', 'dark')).toContain(PAGE_PAPER_DARK);
  });

  it('render all of them quickly enough for the whole gallery', () => {
    const t = cpuNowMs();
    for (const l of layouts) layoutRenderSvg(flow, screen!, l.id);
    expect(cpuNowMs() - t).toBeLessThan(cpuBudgetMs(1000));
  });

  it('render all of them in dark chrome, with the paper walks, quickly enough for the whole gallery', () => {
    const t = cpuNowMs();
    for (const l of layouts) layoutRenderSvg(flow, screen!, l.id, 'dark');
    expect(cpuNowMs() - t).toBeLessThan(cpuBudgetMs(1000));
  });

  // docs/specs/011-theme/light-and-dark.md "Ink marks on the plain paper stay seen": a tile on the dark paper lifts
  // what the paper sinks as the canvas does, so a primary button is the canvas's mid slate, not slate on slate.
  it('draw a dark tile’s ink button as the canvas draws it', () => {
    const placed = buildPageLayout('wf-sign-in', screen!);
    const drawn = createStockColourProjector()(
      placed,
      'dark',
      themeViewMap(undefined, 'dark'),
      plainPaper('dark'),
    );
    const fills = (els: readonly Element[]) =>
      els.map((el) => (el as { fillColor?: string }).fillColor);
    const lifted = fills(drawn).filter(
      (fill, i) => fill !== fills(placed)[i] && fills(placed)[i] === PAGE_PAPER_DARK,
    );
    expect(lifted.length).toBeGreaterThan(0);
    const svg = layoutRenderSvg(flow, screen!, 'wf-sign-in', 'dark');
    for (const fill of lifted) expect(svg).toContain(fill);
    // In light chrome the button keeps its ink.
    expect(layoutRenderSvg(flow, screen!, 'wf-sign-in', 'light')).not.toContain(lifted[0]);
  });
});
