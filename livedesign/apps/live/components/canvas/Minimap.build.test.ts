import { describe, expect, it } from 'vitest';
import { layOutPages, newWireframePage, type Element } from '@livedesign/design';
import { buildPageLayout } from '@livedesign/templates';
import { CANVAS_PAPER } from '@/lib/page-paint';
import { createStockColourProjector, plainPaper } from '@/lib/stock-colour-projector';
import { themeViewMap } from '@/lib/themes';
import { edit, editBoard, pagesOf, prng } from './board-edits-test-support';
import { minimapBuild, minimapParts } from './Minimap';

// docs/specs/008-canvas/canvas-performance.md "The Map draws what changed": the picture built from the parts carried
// over is the picture built afresh, after any edit.
describe('minimapBuild', () => {
  for (const tabFinish of ['flexible', 'professional', 'sketch'] as const)
    it(`carries over only the parts an edit cannot reach (${tabFinish})`, () => {
      const rand = prng(tabFinish.length * 31);
      const parts = minimapParts();
      const base = {
        tabFont: undefined,
        tabFinish,
        iconsLoaded: false,
        surface: 'light' as const,
        chartPalette: undefined,
      };
      let els: Element[] = editBoard(5, 300);
      for (let step = 0; step < 60; step++) {
        els = edit(els, rand, step);
        // The pages' fills switch now and then, with no change on the board.
        const ctx = { ...base, pages: pagesOf(Math.floor(step / 7) % 2 === 0) };
        const got = minimapBuild(parts, els, ctx);
        const want = minimapBuild(minimapParts(), els, ctx);
        expect(got.picture?.href === want.picture?.href, `step ${step}`).toBe(true);
        expect(got.bounds).toEqual(want.bounds);
      }
    });

  it('draws every part again under another surface', () => {
    const parts = minimapParts();
    const els = editBoard(2, 80);
    const base = {
      pages: undefined,
      tabFont: undefined,
      tabFinish: 'flexible' as const,
      iconsLoaded: false,
      chartPalette: undefined,
    };
    const light = minimapBuild(parts, els, { ...base, surface: 'light' });
    const dark = minimapBuild(parts, els, { ...base, surface: 'dark' });
    expect(dark.picture?.href).toBe(
      minimapBuild(minimapParts(), els, { ...base, surface: 'dark' }).picture?.href,
    );
    expect(dark.picture?.href).not.toBe(light.picture?.href);
  });

  // docs/specs/011-theme/light-and-dark.md "Ink marks on the plain paper stay seen" (Work Tracker 897): the Map is drawn
  // from the canvas's own elements (EditorCanvasHost's projection, through inkedOnPaper), so in dark chrome it shows
  // the ink the canvas lifts off the slate paper, never the stored ink the canvas no longer shows.
  it('draws the ink the canvas lifts off the dark paper', () => {
    const [screen] = layOutPages([newWireframePage('s')]);
    const placed = buildPageLayout('wf-sign-in', screen!);
    const canvas = createStockColourProjector()(
      placed,
      'dark',
      themeViewMap(undefined, 'dark'),
      plainPaper('dark'),
    );
    const fills = (els: readonly Element[]) =>
      els.map((el) => (el as { fillColor?: string }).fillColor);
    const lifted = fills(canvas).filter(
      (fill, i) => fill !== fills(placed)[i] && fills(placed)[i] === CANVAS_PAPER.dark,
    );
    expect(lifted.length).toBeGreaterThan(0);
    const map = minimapBuild(minimapParts(), [...canvas], {
      pages: [screen!],
      tabFont: undefined,
      tabFinish: 'flexible',
      iconsLoaded: false,
      surface: 'dark',
      chartPalette: undefined,
    });
    const svg = decodeURIComponent(map.picture!.href);
    for (const fill of lifted) expect(svg).toContain(`fill="${fill}"`);
  });
});
