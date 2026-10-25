import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import type { Page } from './page';
import { laidOutPagesOf, pagesPerRow, renderPageToSvg, renderPagesToSvg } from './svg-render-pages';
import type { Tab } from './index';

// docs/specs/015-api/mcp-server.md §5: a Pages tab drawn as its pages, each as it exports.
const portrait = (id: string, extra: object = {}) => ({
  id,
  orientation: 'portrait',
  size: 'a4',
  kind: 'infographic',
  ...extra,
});

function tab(pages: object[], elements: Tab['elements'] = []): Tab {
  return { id: 't', name: 'T', opensIn: 'pages', pages, elements } as unknown as Tab;
}

describe('a Pages tab drawn as its pages', () => {
  it('embeds a page’s picture background from the image resolver', () => {
    const id = 'a'.repeat(32);
    const t = tab([
      portrait('a', { background: { fill: { kind: 'image', imageId: id, tone: '#336699' } } }),
    ]);
    const page = laidOutPagesOf(t)[0]!;
    const svg = renderPageToSvg(t, page, {
      resolveImageHref: (imageId) => (imageId === id ? 'data:image/png;base64,QUJD' : undefined),
    });
    expect(svg).toContain('data:image/png;base64,QUJD');
  });

  it("lays out a tab's pages", () => {
    expect(laidOutPagesOf(tab([portrait('a')])).map((p) => p.id)).toEqual(['a']);
  });

  it('draws one page as its sheet: its background, and only what reaches onto it', () => {
    const pages = [
      portrait('a', {
        background: {
          fill: { kind: 'gradient', from: '#eef2ff', to: '#dbe4ff', angle: 160 },
          pattern: 'dots',
        },
      }),
      portrait('b', { name: 'Back' }),
    ];
    const laid = laidOutPagesOf(tab(pages));
    const on = {
      ...createShape('square', laid[0]!.rect.x + 10, laid[0]!.rect.y + 10),
      id: 'on',
      label: 'Inside',
    };
    const off = {
      ...createShape('square', laid[1]!.rect.x + 10, laid[1]!.rect.y + 10),
      id: 'off',
      label: 'Elsewhere',
    };
    const t = tab(pages, [on, off] as Tab['elements']);
    const svg = renderPageToSvg(t, laid[0]!);
    const r = laid[0]!.rect;
    expect(svg).toContain(`viewBox="${r.x} ${r.y} ${r.width} ${r.height}"`);
    expect(svg).toContain('linearGradient');
    expect(svg).toContain('<pattern');
    expect(svg).toContain('Inside');
    expect(svg).not.toContain('Elsewhere');
  });

  it('lays every page out in rows, named under each, two to a row of wide pages and three of tall ones', () => {
    const tall = tab([portrait('a'), portrait('b', { name: 'Two' }), portrait('c'), portrait('d')]);
    const svg = renderPagesToSvg(tall)!;
    expect(svg.match(/<svg x=/g)).toHaveLength(4);
    expect(svg).toContain('>2  Two<');
    expect(pagesPerRow(laidOutPagesOf(tall))).toBe(3);
    const wide = (id: string): Page => ({ id, orientation: 'landscape' });
    const wides = tab([wide('s1'), wide('s2'), wide('s3')]);
    expect(pagesPerRow(laidOutPagesOf(wides))).toBe(2);
    expect(pagesPerRow(laidOutPagesOf(tab([wide('s1')])))).toBe(1);
  });
});
