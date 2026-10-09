// @vitest-environment jsdom

// A logo layout's tile is the layout itself, rendered (docs/specs/007-editor/logo-pages.md "Logo
// layouts"): what pressing it puts on the page.
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { layOutIllustratePages, newLogoPage, type Tab } from '@livediagram/document';
import { LOGO_LAYOUTS } from '@livediagram/templates';
import { LogoLayoutThumb, logoLayoutSvg } from './logo-layout-thumb';
import { LayoutThumb } from './infographic-layout-thumb';

afterEach(() => cleanup());

const [page] = layOutIllustratePages([newLogoPage('l')]);
const tab = { id: 't', name: 'T', elements: [], pages: [newLogoPage('l')] } as unknown as Tab;

describe('logo layout tiles', () => {
  it('draw the layout as it lands: its words, framed to the page', () => {
    const svg = logoLayoutSvg(tab, page!, LOGO_LAYOUTS[0]!.id);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Brand');
    expect(svg).toContain(`viewBox="${page!.rect.x} ${page!.rect.y}`);
  });

  it('render as markup sized to the tile, square for the artboard', () => {
    const { container } = render(
      <LogoLayoutThumb layout={LOGO_LAYOUTS[0]!.id} page={page!} width={100} tab={tab} />,
    );
    const tile = container.querySelector<HTMLElement>('[data-logo-layout-thumb]')!;
    expect(tile.style.width).toBe('100px');
    expect(tile.style.height).toBe('100px');
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it('fall back to the wireframe outside an editor', () => {
    const { container } = render(<LayoutThumb layout={LOGO_LAYOUTS[0]!.id} page={page!} />);
    expect(container.querySelector('[data-logo-layout-thumb]')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('render every logo layout quickly enough for a card of them', () => {
    const t = performance.now();
    for (const l of LOGO_LAYOUTS) logoLayoutSvg(tab, page!, l.id);
    // 25 layouts; a card draws at most 7 at once plus 8 small ones.
    expect(performance.now() - t).toBeLessThan(500);
  });
});
