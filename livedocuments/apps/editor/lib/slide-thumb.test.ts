import { describe, expect, it } from 'vitest';
import { createPinnedArrow, createShape, type Tab } from '@livedocuments/document';
import { getTheme, themeChartPalette } from './themes';
import { slideThumbFor } from './slide-thumb';
import { CANVAS_PAPER } from './page-paint';

// docs/specs/007-editor/pages-mode.md "Contents": a page's picture is the page as the canvas shows it.
describe('slideThumbFor', () => {
  const tab = (background?: object) =>
    ({
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 'p', orientation: 'portrait', ...(background ? { background } : {}) }],
    }) as unknown as Tab;
  const slide = { id: 's', tabId: 't', elementIds: [], pageId: 'p' };

  it('draws a page with no fill on the canvas’s own paper: white, or slate in dark mode', () => {
    const light = slideThumbFor(slide, tab(), { iconsLoaded: true })!;
    expect(light.markup).toContain(`fill="${CANVAS_PAPER.light}"`);
    const dark = slideThumbFor(slide, tab(), { iconsLoaded: true, surface: 'dark' })!;
    expect(dark.markup).toContain(`fill="${CANVAS_PAPER.dark}"`);
    expect(dark.markup).not.toContain(`fill="${CANVAS_PAPER.light}"`);
  });

  it('draws a page’s own fill whatever the canvas', () => {
    const filled = tab({ fill: { kind: 'solid', color: '#fef3c7' } });
    const dark = slideThumbFor(slide, filled, { iconsLoaded: true, surface: 'dark' })!;
    expect(dark.markup).toContain('#fef3c7');
  });

  it('draws a chart in the tab theme’s colours, as the canvas does, not the built-in ramp', () => {
    const chart = {
      id: 'c',
      type: 'shape',
      shape: 'bar-chart',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      pieSlices: [
        { label: 'A', value: 1 },
        { label: 'B', value: 2 },
        { label: 'C', value: 3 },
      ],
    };
    const charted = { id: 't', name: 'T', elements: [chart] } as unknown as Tab;
    const thumb = slideThumbFor({ id: 's', tabId: 't', elementIds: ['c'] }, charted, {
      iconsLoaded: true,
    })!;
    for (const colour of themeChartPalette(getTheme(undefined)).slice(0, 3))
      expect(thumb.markup).toContain(`fill="${colour}"`);
  });

  it('draws an image element and a picture fill with the pictures it is handed, a placeholder without', () => {
    const image = {
      id: 'i',
      type: 'image',
      imageId: 'g1',
      objectFit: 'cover',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
    const pictured = {
      ...tab({ fill: { kind: 'image', imageId: 'g0', tone: '#334455' } }),
      elements: [image],
    } as unknown as Tab;
    const resolveImageHref = (id: string) => `blob:${id}`;
    const drawn = slideThumbFor(slide, pictured, { iconsLoaded: true, resolveImageHref })!;
    expect(drawn.markup).toContain('href="blob:g1"');
    expect(drawn.markup).toContain('href="blob:g0"');
    const bare = slideThumbFor(slide, pictured, { iconsLoaded: true })!;
    expect(bare.markup).not.toContain('<image');
    expect(bare.markup).toContain('#334455');
  });

  // docs/specs/008-canvas/canvas-performance.md "A page's picture redraws the parts that changed".
  describe('part by part', () => {
    const board = () => {
      const a = createShape('square', 20, 20);
      const b = createShape('square', 200, 20);
      const arrow = createPinnedArrow(a.id, 'e', b.id, 'w');
      return { a, b, arrow };
    };
    const onPage = (elements: unknown[]) => ({ ...tab(), elements }) as unknown as Tab;

    it('draws the page, then each box, then each arrow, the parts joined being the picture', () => {
      const { a, b, arrow } = board();
      const thumb = slideThumbFor(slide, onPage([a, b, arrow]), { iconsLoaded: true })!;
      expect(thumb.parts.map((p) => p.key)).toEqual(['page', a.id, b.id, arrow.id]);
      expect(thumb.parts.map((p) => p.markup).join('')).toBe(thumb.markup);
    });

    it('carries over a box nothing reached, and draws exactly what a fresh picture draws', () => {
      const { a, b, arrow } = board();
      const before = slideThumbFor(slide, onPage([a, b, arrow]), { iconsLoaded: true })!;
      const moved = { ...b, x: b.x + 40 };
      const after = slideThumbFor(slide, onPage([a, moved, arrow]), { iconsLoaded: true })!;
      expect(after.parts[1]!.markup).toBe(before.parts[1]!.markup);
      expect(after.parts[2]!.markup).not.toBe(before.parts[2]!.markup);
      // Every element a new object: nothing to carry over.
      const fresh = slideThumbFor(slide, onPage(structuredClone([a, moved, arrow])), {
        iconsLoaded: true,
      })!;
      expect(after.markup).toBe(fresh.markup);
    });

    it('draws a carried box again when what it reads beyond itself changes', () => {
      const { a } = board();
      const light = slideThumbFor(slide, onPage([a]), { iconsLoaded: true })!;
      const dark = slideThumbFor(slide, onPage([a]), { iconsLoaded: true, surface: 'dark' })!;
      expect(dark.parts[1]!.markup).toBe(
        slideThumbFor(slide, onPage([structuredClone(a)]), { iconsLoaded: true, surface: 'dark' })!
          .parts[1]!.markup,
      );
      expect(slideThumbFor(slide, onPage([a]), { iconsLoaded: true })!.parts[1]!.markup).toBe(
        light.parts[1]!.markup,
      );
      const image = {
        id: 'i',
        type: 'image',
        imageId: 'g1',
        objectFit: 'cover',
        x: 0,
        y: 0,
        width: 50,
        height: 50,
      };
      const waiting = slideThumbFor(slide, onPage([image]), {
        iconsLoaded: true,
        resolveImageHref: () => undefined,
      })!;
      const arrived = slideThumbFor(slide, onPage([image]), {
        iconsLoaded: true,
        resolveImageHref: (id) => `blob:${id}`,
      })!;
      expect(waiting.parts[1]!.markup).not.toContain('blob:g1');
      expect(arrived.parts[1]!.markup).toContain('href="blob:g1"');
    });
  });
});
