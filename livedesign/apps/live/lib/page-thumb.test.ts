import { describe, expect, it } from 'vitest';
import type { Tab } from '@livedesign/design';
import { getTheme, themeChartPalette } from './themes';
import { pageThumbFor } from './page-thumb';
import { CANVAS_PAPER } from './page-paint';

// docs/specs/007-editor/pages-mode.md "Contents": a page's picture is the page as the canvas shows it.
describe('pageThumbFor', () => {
  const tab = (background?: object) =>
    ({
      id: 't',
      name: 'T',
      elements: [],
      pages: [{ id: 'p', orientation: 'portrait', ...(background ? { background } : {}) }],
    }) as unknown as Tab;

  it('draws a page with no fill on the canvas’s own paper: white, or slate in dark mode', () => {
    const light = pageThumbFor('p', tab(), { iconsLoaded: true })!;
    expect(light.markup).toContain(`fill="${CANVAS_PAPER.light}"`);
    const dark = pageThumbFor('p', tab(), { iconsLoaded: true, surface: 'dark' })!;
    expect(dark.markup).toContain(`fill="${CANVAS_PAPER.dark}"`);
    expect(dark.markup).not.toContain(`fill="${CANVAS_PAPER.light}"`);
  });

  it('draws a photo page as its picture, and the placeholder only while it has none', () => {
    // A photo page is its picture (docs/specs/031-photo/photo-pages.md): Contents once showed every photo page as
    // the same placeholder, so the sizes Make Sizes made could not be told apart.
    const photoTab = {
      id: 't',
      name: 'T',
      elements: [],
      pages: [
        {
          id: 'p',
          orientation: 'landscape',
          kind: 'photo',
          size: 'photo',
          fit: { width: 1920, height: 1080 },
        },
      ],
    } as unknown as Tab;
    const drawn = pageThumbFor('p', photoTab, {
      iconsLoaded: true,
      photoHref: (id) => (id === 'p' ? 'blob:preview-p' : undefined),
    })!;
    expect(drawn.markup).toContain('href="blob:preview-p"');
    expect(drawn.markup).not.toContain('-checker');
    const waiting = pageThumbFor('p', photoTab, { iconsLoaded: true })!;
    expect(waiting.markup).toContain('-checker');
  });

  it('draws a page’s own fill whatever the canvas', () => {
    const filled = tab({ fill: { kind: 'solid', color: '#fef3c7' } });
    const dark = pageThumbFor('p', filled, { iconsLoaded: true, surface: 'dark' })!;
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
    const charted = { ...tab(), elements: [chart] } as unknown as Tab;
    const thumb = pageThumbFor('p', charted, { iconsLoaded: true })!;
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
    const drawn = pageThumbFor('p', pictured, { iconsLoaded: true, resolveImageHref })!;
    expect(drawn.markup).toContain('href="blob:g1"');
    expect(drawn.markup).toContain('href="blob:g0"');
    const bare = pageThumbFor('p', pictured, { iconsLoaded: true })!;
    expect(bare.markup).not.toContain('<image');
    expect(bare.markup).toContain('#334455');
  });
});
