// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  BAND_MID_MIN_PX,
  BAND_RIGHT_MIN_PX,
  MAX_INSET_SHARE,
  headerBand,
  layerInsets,
  measureCanvasChrome,
  sameLayout,
} from './canvas-layer-insets';

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
    expect(measureCanvasChrome(main!)).toEqual({
      insets: { top: 0, left: 272, right: 0, bottom: 0 },
      band: null,
    });
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
    expect(measureCanvasChrome(main!)).toEqual({
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
      band: null,
    });
  });
});

// "The header holds the top row": the element's header grows to the top row, the menu and strip inside it.
describe('headerBand', () => {
  // The Toolbar layout at 1440 px: the menu at the top left, the strip centred, 12 px down the canvas. The element's
  // controls card and its header's right padding: 160 px.
  const menu = box(12, 92, 124, 145);
  const strip = box(497, 92, 943, 145);
  const none = { left: 0, right: 0 };
  const END = 160;
  // Where the strip's right edge goes: 12 px before the controls, inside the cover's 12 px padding.
  const stripRight = 1440 - 12 - END - 12;

  it('runs as tall as the row, the strip pressed against the controls, the content between it and the menu', () => {
    expect(headerBand(canvas, none, menu, strip, 0, END)).toEqual({
      height: 145 - (80 + 12),
      left: 124 - 12 + 12,
      mid: stripRight - 446 - 12 - 124 - 12,
      stripEnd: 1440 - stripRight,
    });
  });

  // Moving the strip never takes the band away: only its width counts.
  it('lays the same band out wherever the strip is now', () => {
    const moved = box(stripRight - 446, 92, stripRight, 145);
    expect(headerBand(canvas, none, menu, moved, 0, END)).toEqual(
      headerBand(canvas, none, menu, strip, 0, END),
    );
  });

  it('is not laid out without a menu, or with the menu or strip low on the canvas', () => {
    expect(headerBand(canvas, none, null, strip)).toBeNull();
    expect(headerBand(canvas, none, menu, box(497, 700, 943, 750))).toBeNull();
    expect(headerBand(canvas, none, box(12, 700, 124, 750), null)).toBeNull();
  });

  it('holds the menu alone with no strip, its content running to the controls', () => {
    expect(headerBand(canvas, none, menu, null, 0, END)).toEqual({
      height: 145 - (80 + 12),
      left: 124 - 12 + 12,
      mid: stripRight - 12 - 124 - 12,
      stripEnd: 1440 - stripRight,
    });
  });

  it('is not laid out when the menu sits in the strip (a phone) or the canvas is narrow', () => {
    expect(headerBand(canvas, none, box(40, 92, 90, 145), box(12, 92, 380, 145))).toBeNull();
    expect(headerBand({ ...canvas, right: 600 }, none, menu, box(150, 92, 400, 145))).toBeNull();
  });

  it('needs room for a title between the menu and the strip at the right', () => {
    // The strip's width that leaves exactly BAND_MID_MIN_PX.
    const widest = stripRight - 124 - 24 - BAND_MID_MIN_PX;
    expect(headerBand(canvas, none, menu, box(200, 92, 200 + widest, 145), 0, END)).not.toBeNull();
    expect(headerBand(canvas, none, menu, box(200, 92, 201 + widest, 145), 0, END)).toBeNull();
    // A side panel taking the right of the canvas takes the room with it.
    expect(headerBand(canvas, { left: 0, right: 900 }, menu, strip, 0, END)).toBeNull();
    // Unmeasured controls are given BAND_RIGHT_MIN_PX.
    expect(headerBand(canvas, none, menu, strip)!.stripEnd).toBe(12 + BAND_RIGHT_MIN_PX + 12);
  });

  // "The name rides in the menu box": the room is judged without the name, the content starting after the box.
  it('judges the room from the menu box without the name riding in it', () => {
    const wide = box(200, 92, 200 + stripRight - 124 - 24 - BAND_MID_MIN_PX, 145);
    const withName = box(12, 92, 124 + 200, 145);
    const band = headerBand(canvas, none, withName, wide, 200, END);
    expect(band).not.toBeNull();
    expect(band!.left).toBe(124 + 200 - 12 + 12);
    // The strip now starts before the box's end: the content has no room, never a negative one.
    expect(band!.mid).toBe(0);
    expect(headerBand(canvas, none, withName, wide, 0, END)).toBeNull();
  });

  it('measures off the page with the top inset given up to the header', () => {
    document.body.innerHTML = `
      <main data-canvas-a11y-root=""></main>
      <div data-toolbar-menu=""></div>
      <div data-toolbar-palette=""><div></div></div>`;
    const [main, menuEl, stripEl] = [...document.body.children] as HTMLElement[];
    const rect = (r: { left: number; top: number; right: number; bottom: number }) => () =>
      ({ ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top }) as DOMRect;
    main!.getBoundingClientRect = rect(canvas);
    menuEl!.getBoundingClientRect = rect(menu);
    // The strip's root runs the canvas's width; its card is what counts.
    stripEl!.getBoundingClientRect = rect(box(0, 92, 1440, 145));
    (stripEl!.firstElementChild as HTMLElement).getBoundingClientRect = rect(strip);
    const layout = measureCanvasChrome(main!);
    expect(layout.insets.top).toBe(0);
    expect(layout.band).toEqual(headerBand(canvas, none, menu, strip));
  });

  it('measures the covering element’s controls card and its header’s padding', () => {
    document.body.innerHTML = `
      <main data-canvas-a11y-root="">
        <div data-canvas-cover=""><div style="padding-right: 16px"><span data-band-controls=""></span></div></div>
      </main>
      <div data-toolbar-menu=""></div>
      <div data-toolbar-palette=""><div></div></div>`;
    const [main, menuEl, stripEl] = [...document.body.children] as HTMLElement[];
    const rect = (r: { left: number; top: number; right: number; bottom: number }) => () =>
      ({ ...r, x: r.left, y: r.top, width: r.right - r.left, height: r.bottom - r.top }) as DOMRect;
    main!.getBoundingClientRect = rect(canvas);
    menuEl!.getBoundingClientRect = rect(menu);
    (stripEl!.firstElementChild as HTMLElement).getBoundingClientRect = rect(strip);
    const controls = main!.querySelector<HTMLElement>('[data-band-controls]')!;
    Object.defineProperty(controls, 'offsetWidth', { value: 144 });
    expect(measureCanvasChrome(main!).band).toEqual(headerBand(canvas, none, menu, strip, 0, 160));
  });
});

describe('sameLayout', () => {
  const insets = { top: 0, left: 0, right: 0, bottom: 0 };
  const band = { height: 53, left: 124, mid: 349, stripEnd: 300 };
  it('compares the insets and the band by value', () => {
    expect(sameLayout({ insets, band }, { insets: { ...insets }, band: { ...band } })).toBe(true);
    expect(sameLayout({ insets, band }, { insets, band: { ...band, mid: 300 } })).toBe(false);
    expect(sameLayout({ insets, band }, { insets, band: { ...band, stripEnd: 280 } })).toBe(false);
    expect(sameLayout({ insets, band }, { insets, band: null })).toBe(false);
    expect(sameLayout({ insets, band: null }, { insets, band: null })).toBe(true);
  });
});
