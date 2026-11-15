import { describe, expect, it } from 'vitest';
import {
  createPinnedArrow,
  createShape,
  layOutPages,
  newWireframePage,
  type Element,
  type Tab,
} from '@livedesign/design';
import { buildPageLayout } from '@livedesign/templates';
import { cpuBudgetMs, cpuNowMs } from '@liveworkspace/vitest-config/cpu-time';
import { createStockColourProjector, plainPaper } from './stock-colour-projector';
import { getTheme, themeChartPalette, themeViewMap } from './themes';
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
      const thumb = pageThumbFor('p', onPage([a, b, arrow]), { iconsLoaded: true })!;
      expect(thumb.parts.map((p) => p.key)).toEqual(['page', a.id, b.id, arrow.id]);
      expect(thumb.parts.map((p) => p.markup).join('')).toBe(thumb.markup);
    });

    it('carries over a box nothing reached, and draws exactly what a fresh picture draws', () => {
      const { a, b, arrow } = board();
      const before = pageThumbFor('p', onPage([a, b, arrow]), { iconsLoaded: true })!;
      const moved = { ...b, x: b.x + 40 };
      const after = pageThumbFor('p', onPage([a, moved, arrow]), { iconsLoaded: true })!;
      expect(after.parts[1]!.markup).toBe(before.parts[1]!.markup);
      expect(after.parts[2]!.markup).not.toBe(before.parts[2]!.markup);
      const fresh = pageThumbFor('p', onPage(structuredClone([a, moved, arrow])), {
        iconsLoaded: true,
      })!;
      expect(after.markup).toBe(fresh.markup);
    });

    it('draws a carried box again when what it reads beyond itself changes', () => {
      const { a } = board();
      const dark = pageThumbFor('p', onPage([a]), { iconsLoaded: true, surface: 'dark' })!;
      expect(dark.parts[1]!.markup).toBe(
        pageThumbFor('p', onPage([structuredClone(a)]), { iconsLoaded: true, surface: 'dark' })!
          .parts[1]!.markup,
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
      const waiting = pageThumbFor('p', onPage([image]), {
        iconsLoaded: true,
        resolveImageHref: () => undefined,
      })!;
      const arrived = pageThumbFor('p', onPage([image]), {
        iconsLoaded: true,
        resolveImageHref: (id) => `blob:${id}`,
      })!;
      expect(waiting.parts[1]!.markup).not.toContain('blob:g1');
      expect(arrived.parts[1]!.markup).toContain('href="blob:g1"');
    });
  });

  // docs/specs/011-theme/light-and-dark.md "Ink marks on the plain paper stay seen" (Work Tracker 897): a plain page's
  // picture in dark chrome lifts what the slate paper sinks as the canvas does, so a sign-in screen's primary button is
  // the canvas's mid slate, not slate on slate, and Contents never shows ink the canvas no longer shows.
  describe('on the dark paper', () => {
    const page = newWireframePage('s');
    const [laid] = layOutPages([page]);
    const signIn = () => buildPageLayout('wf-sign-in', laid!);
    const screenTab = (elements: Element[]) =>
      ({ id: 't', name: 'T', elements, pages: [page] }) as unknown as Tab;
    const fills = (els: readonly Element[]) =>
      els.map((el) => (el as { fillColor?: string }).fillColor);

    it('inks a button as the canvas does', () => {
      const placed = signIn();
      const canvas = createStockColourProjector()(
        placed,
        'dark',
        themeViewMap(undefined, 'dark'),
        plainPaper('dark'),
      );
      const lifted = fills(canvas).filter(
        (fill, i) => fill !== fills(placed)[i] && fills(placed)[i] === CANVAS_PAPER.dark,
      );
      expect(lifted.length).toBeGreaterThan(0);
      const dark = pageThumbFor('s', screenTab(placed), { iconsLoaded: true, surface: 'dark' })!;
      for (const fill of lifted) expect(dark.markup).toContain(`fill="${fill}"`);
      // Every box is drawn exactly as the canvas's own element would be drawn.
      const fresh = pageThumbFor('s', screenTab(structuredClone(placed)), {
        iconsLoaded: true,
        surface: 'dark',
      })!;
      expect(fresh.markup).toBe(dark.markup);
      // In light chrome the button keeps its stored ink.
      const light = pageThumbFor('s', screenTab(placed), { iconsLoaded: true })!;
      expect(light.markup).not.toContain(`fill="${lifted[0]}"`);
    });

    it('leaves a page with a fill of its own as that page draws it', () => {
      const filled = { ...page, background: { fill: { kind: 'solid', color: '#ffffff' } } };
      const placed = signIn();
      const tabOf = { ...screenTab(placed), pages: [filled] } as unknown as Tab;
      const dark = pageThumbFor('s', tabOf, { iconsLoaded: true, surface: 'dark' })!;
      const light = pageThumbFor('s', tabOf, { iconsLoaded: true })!;
      expect(dark.markup).toBe(light.markup);
    });

    it('carries over a box the walk left alone, and redraws a page of 40 screens within budget', () => {
      const placed = signIn();
      const first = pageThumbFor('s', screenTab(placed), { iconsLoaded: true, surface: 'dark' })!;
      const again = pageThumbFor('s', screenTab([...placed]), {
        iconsLoaded: true,
        surface: 'dark',
      })!;
      first.parts.forEach((part, i) => expect(again.parts[i]!.markup).toBe(part.markup));
      // A many-page design: 40 sign-in screens, each drawn cold on the dark paper.
      const t = cpuNowMs();
      for (let n = 0; n < 40; n++)
        pageThumbFor('s', screenTab(structuredClone(placed)), {
          iconsLoaded: true,
          surface: 'dark',
        });
      expect(cpuNowMs() - t).toBeLessThan(cpuBudgetMs(1000));
    });
  });
});
