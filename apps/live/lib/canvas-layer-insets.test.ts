// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { MAX_INSET_SHARE, layerInsets, measureCanvasChrome } from './canvas-layer-insets';

// docs/specs/026-plan/plan-board.md "Maximised board": a maximised or tab-filling board sits clear of the chrome over
// the canvas, measured from it.
const canvas = { left: 0, top: 80, right: 1440, bottom: 860 };
const box = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});

describe('layerInsets', () => {
  it('is nothing with no chrome over the canvas', () => {
    expect(layerInsets(canvas, [])).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    // Chrome outside the canvas (the header above it) does not count.
    expect(layerInsets(canvas, [{ kind: 'top', box: box(0, 0, 300, 70) }])).toMatchObject({
      top: 0,
    });
  });

  it('starts below the Toolbar layout’s top row: its strip and its menu', () => {
    expect(layerInsets(canvas, [{ kind: 'top', box: box(12, 92, 220, 140) }], 52)).toMatchObject({
      top: 60,
      left: 0,
      right: 0,
    });
  });

  it('stands beside side panels', () => {
    const out = layerInsets(canvas, [
      { kind: 'panel', box: box(16, 96, 272, 620) },
      { kind: 'panel', box: box(16, 640, 272, 840) },
      { kind: 'panel', box: box(1170, 96, 1424, 420) },
    ]);
    expect(out).toEqual({ top: 0, left: 272, right: 270, bottom: 0 });
  });

  it('reads a sheet across the canvas as top or bottom, never a side', () => {
    const phone = { left: 0, top: 60, right: 390, bottom: 780 };
    expect(layerInsets(phone, [{ kind: 'panel', box: box(0, 600, 390, 780) }])).toEqual({
      top: 0,
      left: 0,
      right: 0,
      bottom: 180,
    });
    expect(layerInsets(phone, [{ kind: 'panel', box: box(0, 60, 390, 120) }])).toMatchObject({
      top: 60,
    });
  });

  it('never gives up more than its share of the canvas', () => {
    const out = layerInsets(canvas, [{ kind: 'panel', box: box(0, 100, 800, 800) }]);
    expect(out.left).toBe(Math.round(1440 * MAX_INSET_SHARE));
  });
});

describe('measureCanvasChrome', () => {
  it('reads the marked chrome off the page', () => {
    document.body.innerHTML = `
      <main data-canvas-a11y-root=""></main>
      <div data-layout-chrome=""></div>
      <div data-layout-chrome="" style="visibility: hidden"></div>`;
    const [main, panel, hidden] = [...document.body.children] as HTMLElement[];
    const rect = (r: { left: number; top: number; right: number; bottom: number }) => () =>
      ({ ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top }) as DOMRect;
    main!.getBoundingClientRect = rect(canvas);
    panel!.getBoundingClientRect = rect(box(16, 96, 272, 620));
    hidden!.getBoundingClientRect = rect(box(1100, 96, 1424, 620));
    expect(measureCanvasChrome(main!)).toEqual({ top: 0, left: 272, right: 0, bottom: 0 });
  });

  // "Maximised board": a panel opened for a moment (the Trash, a card search) floats over the board, never moving it.
  it('ignores a passing panel, however wide', () => {
    document.body.innerHTML = `
      <main data-canvas-a11y-root=""></main>
      <div data-floating-panel="" data-panel-translucent=""></div>`;
    const [main, trash] = [...document.body.children] as HTMLElement[];
    main!.getBoundingClientRect = () =>
      ({ ...canvas, x: 0, y: 80, width: 1440, height: 780 }) as DOMRect;
    trash!.getBoundingClientRect = () =>
      ({
        left: 1040,
        top: 96,
        right: 1424,
        bottom: 840,
        x: 1040,
        y: 96,
        width: 384,
        height: 744,
      }) as DOMRect;
    expect(measureCanvasChrome(main!)).toEqual({ top: 0, left: 0, right: 0, bottom: 0 });
  });
});
