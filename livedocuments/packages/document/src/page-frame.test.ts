import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { layOutPages, newLogoPage } from './page';
import type { PageImageFill } from './page-image';
import { pageExportFrame, pageGradientLine, pageImageSvg, pagePatternInk } from './page-frame';
import type { Element } from './index';

// docs/specs/007-editor/pages-mode.md "Export": one page as an export draws it, shared by the editor's exports
// and an agent's previews.
const fill = (over: Partial<PageImageFill> = {}): PageImageFill => ({
  kind: 'image',
  imageId: 'img-1',
  tone: '#203040',
  overlay: { kind: 'light', strength: 0.6 },
  ...over,
});

describe('a picture in an export', () => {
  const rect = { x: 0, y: 0, width: 100, height: 200 };

  it('embeds the picture cropped to cover, under its overlay', () => {
    const svg = pageImageSvg(fill({ position: 'bottom' }), rect, 'data:image/png;base64,AA==', 'p');
    expect(svg).toContain('<rect x="0" y="0" width="100" height="200" fill="#203040"/>');
    expect(svg).toContain('href="data:image/png;base64,AA==" preserveAspectRatio="xMidYMax slice"');
    expect(svg).toContain('fill="#ffffff" fill-opacity="0.6"');
    expect(svg.indexOf('<image')).toBeLessThan(svg.indexOf('fill-opacity'));
  });

  it('fades with a gradient, and paints the tone where the bytes are missing', () => {
    const svg = pageImageSvg(
      fill({ overlay: { kind: 'fade', strength: 0.7 } }),
      rect,
      undefined,
      'p',
    );
    expect(svg).not.toContain('<image');
    expect(svg).toContain('<linearGradient id="p-fade"');
    expect(svg).toContain('stop-opacity="0.7"');
  });

  it('is the page frame’s background, with the bytes it is handed', () => {
    const [page] = layOutPages([
      { id: 'p1', orientation: 'portrait', background: { fill: fill(), pattern: 'grid' } },
    ]);
    const withBytes = pageExportFrame(page!, { imageHref: () => 'data:image/jpeg;base64,BB==' });
    expect(withBytes.backgroundSvg).toContain('href="data:image/jpeg;base64,BB=="');
    expect(withBytes.backgroundSvg.indexOf('<image')).toBeLessThan(
      withBytes.backgroundSvg.indexOf('-pattern'),
    );
    // The Map and the thumbnails have no bytes: the page in its tone, overlaid.
    const map = pageExportFrame(page!, { paper: '#0f172a' });
    expect(map.backgroundSvg).not.toContain('<image');
    expect(map.backgroundSvg).toContain('fill="#203040"');
    expect(map.surface).toBe('light');
  });
});

describe('a page’s frame', () => {
  const [a4] = layOutPages([{ id: 'a', orientation: 'portrait' }]);

  it('paints a gradient, a solid, a pattern or ruled lines, and its paper', () => {
    const [g] = layOutPages([
      {
        id: 'g',
        orientation: 'portrait',
        background: {
          fill: { kind: 'gradient', from: '#000000', to: '#ffffff', angle: 90 },
          pattern: 'dots',
        },
      },
    ]);
    const grad = pageExportFrame(g!);
    expect(grad.backgroundSvg).toContain('<linearGradient');
    expect(grad.backgroundSvg).toContain('<circle');
    const [s] = layOutPages([
      {
        id: 's',
        orientation: 'portrait',
        background: { fill: { kind: 'solid', color: '#0f172a' }, pattern: 'lines' },
      },
    ]);
    const ruled = pageExportFrame(s!, { ruling: { pitch: 24, inset: 96, top: 96 } });
    expect(ruled.backgroundSvg).toContain('fill="#0f172a"');
    expect(ruled.surface).toBe('dark');
    expect(pageExportFrame(s!).backgroundSvg).toContain('<pattern');
    expect(pageExportFrame(a4!).backgroundSvg).toContain('fill="#ffffff"');
    expect(pagePatternInk({ fill: { kind: 'solid', color: '#0f172a' } })).toContain('255 255 255');
    expect(pagePatternInk(undefined)).toContain('15 23 42');
  });

  it('leaves a logo page’s plain paper see-through when asked', () => {
    const [logo] = layOutPages([newLogoPage('l')]);
    expect(pageExportFrame(logo!, { transparentPaper: true })).toMatchObject({
      transparent: true,
      backgroundSvg: '',
    });
  });

  it('holds what reaches onto the page, an arrow by its ends', () => {
    const r = a4!.rect;
    const frame = pageExportFrame(a4!);
    const inside = { ...createShape('square', r.x + 10, r.y + 10), id: 'in' } as Element;
    const outside = { ...createShape('square', r.x + r.width + 500, r.y), id: 'out' } as Element;
    const arrow = {
      id: 'ar',
      type: 'arrow',
      from: { kind: 'free', x: r.x - 50, y: r.y + 5 },
      to: { kind: 'free', x: r.x + 50, y: r.y + 5 },
    } as unknown as Element;
    const away = {
      id: 'aw',
      type: 'arrow',
      from: { kind: 'free', x: -9000, y: -9000 },
      to: { kind: 'free', x: -8000, y: -9000 },
    } as unknown as Element;
    const els = [inside, outside, arrow, away];
    expect(els.filter((el) => frame.reaches(el, els)).map((el) => el.id)).toEqual(['in', 'ar']);
  });

  it('never holds an article’s note marker, on the page or not', () => {
    const r = a4!.rect;
    const note = {
      id: 'n',
      type: 'annotation',
      x: r.x + 10,
      y: r.y + 10,
      width: 32,
      height: 32,
      articleNote: { kind: 'comment' },
    } as unknown as Element;
    expect(pageExportFrame(a4!).reaches(note, [note])).toBe(false);
  });
});

describe('markup over the paper', () => {
  // A slide's animated background's opening frame goes over its gradient and under its pattern
  // (docs/specs/007-editor/pages-mode.md "Animated backgrounds").
  it('sits over the fill and under the pattern', () => {
    const [page] = layOutPages([
      {
        id: 's',
        orientation: 'landscape',
        kind: 'slide',
        background: {
          fill: { kind: 'gradient', from: '#000000', to: '#ffffff', angle: 90 },
          pattern: 'dots',
        },
      },
    ]);
    // Under the pattern: the SVG's frame is an opaque picture, so over the pattern it would hide it.
    const svg = pageExportFrame(page!, { overFill: '<image id="frame"/>' }).backgroundSvg;
    const fill = svg.indexOf('-fill)"');
    const frame = svg.indexOf('<image id="frame"/>');
    expect(fill).toBeGreaterThan(-1);
    expect(frame).toBeGreaterThan(fill);
    expect(svg.indexOf('-pattern)"')).toBeGreaterThan(frame);
  });
});

describe('pageGradientLine', () => {
  it('runs through the centre at the angle, as long as the box across it', () => {
    const fill = { kind: 'gradient' as const, from: '#000', to: '#fff', angle: 90 };
    const l = pageGradientLine(fill, { x: 0, y: 0, width: 200, height: 100 });
    expect(l.x1).toBeCloseTo(0);
    expect(l.y1).toBeCloseTo(50);
    expect(l.x2).toBeCloseTo(200);
    expect(l.y2).toBeCloseTo(50);
  });
});
