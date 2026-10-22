// The view rests on a page (docs/specs/007-editor/pages-mode.md "Getting around the pages").
import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@livedesign/vitest-config/cpu-time';
import { layOutPages, type LaidOutPage } from '@livedesign/document';
import { besideSideInsets, computeFitBelow } from './viewport';
import {
  SNAP_EDGE_ROOM,
  SNAP_FLICK_MIN_PX,
  SNAP_FLICK_PX_PER_MS,
  SNAP_SWIPE_FRACTION,
  clampAxis,
  pageSnap,
  type SnapBand,
  type SnapFrame,
} from './page-snap';

const SCREEN = { width: 1200, height: 800 };
const BAND: SnapBand = { left: 0, right: 1200, top: 0, bottom: 800 };
const pages = layOutPages([
  { id: 'p1', size: 'slide' },
  { id: 'p2', size: 'slide' },
  { id: 'p3', size: 'slide' },
] as never);
const page = (id: string) => pages.find((p) => p.id === id)!;
const fitOf = (p: LaidOutPage): SnapFrame => computeFitBelow(SCREEN, p.rect, 0);
const snap = (view: SnapFrame, extra: Partial<Parameters<typeof pageSnap>[0]> = {}) =>
  pageSnap({ pages, view, screen: SCREEN, band: BAND, fitOf, ...extra });
// The view at a page's fit, panned `dx` screen px (positive: the content moved left, the view on
// toward the next page).
const panned = (id: string, dx: number, dy = 0): SnapFrame => {
  const fit = fitOf(page(id));
  return {
    zoom: fit.zoom,
    offset: { x: fit.offset.x - dx / fit.zoom, y: fit.offset.y - dy / fit.zoom },
  };
};
// Where a page's edges land on screen.
const onScreen = (frame: SnapFrame, p: LaidOutPage) => {
  const sx = (x: number) => SCREEN.width / 2 + frame.zoom * (x + frame.offset.x - SCREEN.width / 2);
  const sy = (y: number) =>
    SCREEN.height / 2 + frame.zoom * (y + frame.offset.y - SCREEN.height / 2);
  return {
    left: sx(p.rect.x),
    right: sx(p.rect.x + p.rect.width),
    top: sy(p.rect.y),
    bottom: sy(p.rect.y + p.rect.height),
  };
};

describe('pageSnap: which page', () => {
  it('leaves a view already fitting a page be', () => {
    expect(snap(fitOf(page('p2')))).toBeNull();
  });

  it('fits the page under the middle when the view rests between pages', () => {
    const view = panned('p1', 0.7 * page('p1').rect.width * fitOf(page('p1')).zoom);
    expect(snap(view)).toMatchObject({ pageId: 'p2', frame: fitOf(page('p2')), swiped: false });
  });

  it('fits the nearest page when the view rests beyond the row', () => {
    const view = panned('p3', 4000);
    expect(snap(view)?.pageId).toBe('p3');
    expect(snap(panned('p1', -4000))?.pageId).toBe('p1');
  });

  it('pulls a view panned off the page vertically back onto it', () => {
    expect(snap(panned('p2', 0, 300))).toMatchObject({ pageId: 'p2', frame: fitOf(page('p2')) });
  });

  it('fits the page when zoomed out past its fit', () => {
    const fit = fitOf(page('p2'));
    expect(snap({ zoom: fit.zoom / 3, offset: fit.offset })?.frame).toEqual(fit);
  });

  it('counts a zoom a hair past fit as the fit', () => {
    const fit = fitOf(page('p2'));
    expect(snap({ zoom: fit.zoom * 1.01, offset: fit.offset })?.frame).toEqual(fit);
  });

  it('centres in what shows beside the Contents sidebar', () => {
    const band = { ...BAND, left: 236 };
    const fitBeside = (p: LaidOutPage) =>
      besideSideInsets(computeFitBelow({ width: 964, height: 800 }, p.rect, 0), {
        left: 236,
        right: 0,
      });
    // Zoomed out past the fit beside it.
    const view = { zoom: 0.3, offset: fitOf(page('p2')).offset };
    const out = pageSnap({ pages, view, screen: SCREEN, band, fitOf: fitBeside });
    expect(out?.frame).toEqual(fitBeside(page('p2')));
  });

  it('answers null with no pages', () => {
    expect(
      pageSnap({ pages: [], view: fitOf(page('p1')), screen: SCREEN, band: BAND, fitOf }),
    ).toBeNull();
  });
});

describe('pageSnap: swiping to the next page', () => {
  const width = BAND.right - BAND.left;

  it('turns to the next page after a pan of a fifth of the view', () => {
    const view = panned('p2', SNAP_SWIPE_FRACTION * width + 1);
    expect(snap(view, { from: 'p2', velocity: 0 })).toMatchObject({ pageId: 'p3', swiped: true });
  });

  it('turns to the previous page the other way', () => {
    const view = panned('p2', -(SNAP_SWIPE_FRACTION * width + 1));
    expect(snap(view, { from: 'p2', velocity: 0 })).toMatchObject({ pageId: 'p1', swiped: true });
  });

  it('springs back after a shorter, slow pan', () => {
    const view = panned('p2', SNAP_SWIPE_FRACTION * width - 20);
    expect(snap(view, { from: 'p2', velocity: 0 })).toMatchObject({ pageId: 'p2', swiped: false });
  });

  it('turns on a quick flick past the minimum travel', () => {
    const view = panned('p2', SNAP_FLICK_MIN_PX + 1);
    // The content moving left, fast.
    expect(snap(view, { from: 'p2', velocity: -SNAP_FLICK_PX_PER_MS })?.pageId).toBe('p3');
  });

  it('ignores a flick against the travel, or under the minimum', () => {
    expect(snap(panned('p2', SNAP_FLICK_MIN_PX + 1), { from: 'p2', velocity: 2 })?.pageId).toBe(
      'p2',
    );
    expect(snap(panned('p2', SNAP_FLICK_MIN_PX - 4), { from: 'p2', velocity: -2 })?.pageId).toBe(
      'p2',
    );
  });

  it('stays at either end of the row', () => {
    expect(snap(panned('p3', 400), { from: 'p3', velocity: -2 })?.pageId).toBe('p3');
    expect(snap(panned('p1', -400), { from: 'p1', velocity: 2 })?.pageId).toBe('p1');
  });

  it('never turns without a pan (a pinch or a zoom)', () => {
    expect(snap(panned('p2', 400), { from: 'p2' })?.pageId).toBe('p2');
  });

  it('never turns from a zoomed-in page', () => {
    const fit = fitOf(page('p2'));
    const view = {
      zoom: fit.zoom * 2,
      offset: { x: fit.offset.x - 300 / fit.zoom, y: fit.offset.y },
    };
    expect(snap(view, { from: 'p2', velocity: -2 })?.swiped ?? false).toBe(false);
  });

  it('lands on the page reached by a long pan, not a further one', () => {
    const view = fitOf(page('p3'));
    expect(snap(view, { from: 'p1', velocity: -2 })).toBeNull();
  });
});

// A watch fits far closer than an article: moving on from one seen whole lands on the next at its
// own fit, never at the watch's zoom.
describe('pageSnap: pages of different fits', () => {
  const mixed = layOutPages([
    { id: 'w', kind: 'wireframe', size: 'device', device: 'watch' },
    { id: 'a', kind: 'article', size: 'a4' },
  ] as never);
  const at = (id: string) => mixed.find((p) => p.id === id)!;
  // A wireframe page may zoom in past 100% to fill the screen (usePagesMode).
  const mixedFit = (p: LaidOutPage): SnapFrame =>
    computeFitBelow(SCREEN, p.rect, 0, p.kind === 'wireframe' ? 2.5 : undefined);
  const watch = mixedFit(at('w'));

  it('swipes from a watch seen whole to the article at the article’s fit', () => {
    const view = {
      zoom: watch.zoom,
      offset: {
        x: watch.offset.x - (SNAP_SWIPE_FRACTION * SCREEN.width + 1) / watch.zoom,
        y: watch.offset.y,
      },
    };
    const result = pageSnap({
      pages: mixed,
      view,
      screen: SCREEN,
      band: BAND,
      fitOf: mixedFit,
      from: 'w',
      velocity: 0,
    });
    expect(watch.zoom).toBeGreaterThan(mixedFit(at('a')).zoom * 2);
    expect(result).toMatchObject({ pageId: 'a', frame: mixedFit(at('a')) });
  });

  it('pans from a watch seen whole onto the article at the article’s fit', () => {
    const a = mixedFit(at('a'));
    // The view's middle over the article, still at the watch's zoom.
    const view = { zoom: watch.zoom, offset: { x: a.offset.x, y: a.offset.y } };
    const result = pageSnap({
      pages: mixed,
      view,
      screen: SCREEN,
      band: BAND,
      fitOf: mixedFit,
      from: 'w',
    });
    expect(result).toMatchObject({ pageId: 'a', frame: a });
  });
});

describe('pageSnap: zoomed in', () => {
  it('stays zoomed in, the page kept across what shows', () => {
    const fit = fitOf(page('p2'));
    const zoom = fit.zoom * 3;
    // Panned so the page's left edge is well inside the view, the page still under its middle.
    const view = { zoom, offset: { x: fit.offset.x + 1500 / zoom, y: fit.offset.y } };
    const out = snap(view);
    expect(out?.frame.zoom).toBe(zoom);
    expect(onScreen(out!.frame, page('p2')).left).toBeCloseTo(SNAP_EDGE_ROOM);
  });

  it('leaves a zoomed-in view inside the page be', () => {
    const fit = fitOf(page('p2'));
    expect(snap({ zoom: fit.zoom * 3, offset: fit.offset })).toBeNull();
  });

  it('allows the edge room, no more', () => {
    const fit = fitOf(page('p2'));
    const zoom = fit.zoom * 3;
    const out = snap({ zoom, offset: { x: fit.offset.x, y: fit.offset.y - 5000 / zoom } });
    expect(onScreen(out!.frame, page('p2')).bottom).toBeCloseTo(SCREEN.height - SNAP_EDGE_ROOM);
  });
});

describe('clampAxis', () => {
  it('centres a page narrower than the band less its edge room', () => {
    // A 400 px page at zoom 1 in a 1200 px band: centred at 400..800.
    const offset = clampAxis(0, 1, 1200, 0, 400, 0, 1200);
    expect(600 + 1 * (0 + offset - 600)).toBe(400);
  });

  it('holds a wider page between the edges, each up to the room inside', () => {
    // A 2000 px page whose left edge sits at 500: pulled back to the room.
    const at = (offset: number) => 600 + (offset - 600);
    expect(at(clampAxis(500, 1, 1200, 0, 2000, 0, 1200))).toBe(SNAP_EDGE_ROOM);
    // Already covering: untouched.
    expect(clampAxis(-300, 1, 1200, 0, 2000, 0, 1200)).toBe(-300);
  });
});

describe('pageSnap: cost', () => {
  it('stays cheap at the page limit (measured ~6 µs a snap at 100 pages)', () => {
    const many = layOutPages(
      Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, size: 'slide' })) as never,
    );
    const fitMany = (p: LaidOutPage) => computeFitBelow(SCREEN, p.rect, 0);
    const view = { zoom: 0.3, offset: fitMany(many[99]!).offset };
    const spent = cpuMsOf(() => {
      for (let i = 0; i < 1000; i++) {
        pageSnap({
          pages: many,
          view,
          screen: SCREEN,
          band: BAND,
          fitOf: fitMany,
          from: 'p99',
          velocity: -1,
        });
      }
    });
    expect(spent).toBeLessThan(cpuBudgetMs(100));
  });
});
