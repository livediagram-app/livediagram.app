// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import type { Element as CanvasElement } from '@livediagram/document';
import {
  focusView,
  pickMainElement,
  PHONE_FOCUS_MAX_ZOOM,
  PHONE_READABLE_ZOOM,
  tabOpeningView,
} from './tab-opening-view';
import { tabFitView } from './tab-fit-view';

// docs/specs/008-canvas/canvas-and-palette.md "On a phone the opening view focuses on the main element".

const box = (type: string, id: string, x: number, y: number, width = 100, height = 50) =>
  ({ id, type, shape: 'square', x, y, width, height, label: '' }) as unknown as CanvasElement;
const shape = (id: string, x: number, y: number, width?: number, height?: number) =>
  box('shape', id, x, y, width, height);
const arrow = (id: string, from: string, to: string) =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'pinned', elementId: from, anchor: 'e' },
    to: { kind: 'pinned', elementId: to, anchor: 'w' },
  }) as unknown as CanvasElement;
const freeArrow = (id: string) =>
  ({
    id,
    type: 'arrow',
    from: { kind: 'free', x: 0, y: 0 },
    to: { kind: 'free', x: 10, y: 10 },
  }) as unknown as CanvasElement;

// A phone-sized canvas: 390 x 700.
const canvas = () => {
  const node = document.createElement('main');
  node.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 390, bottom: 700, width: 390, height: 700 }) as DOMRect;
  document.body.append(node);
  return node;
};

afterEach(() => document.body.replaceChildren());

// Where the view's centre lands, in canvas coordinates.
const centreOf = (view: { offset: { x: number; y: number } }, w = 390, h = 700) => ({
  x: w / 2 - view.offset.x,
  y: h / 2 - view.offset.y,
});

describe('pickMainElement', () => {
  it('is null for a tab with no boxed element', () => {
    expect(pickMainElement([])).toBeNull();
    expect(pickMainElement([freeArrow('a')])).toBeNull();
  });

  it('picks the most connected element, wherever it sits', () => {
    const els = [
      shape('a', 0, 0),
      shape('hub', 2000, 0),
      shape('b', 0, 400),
      shape('c', 400, 400),
      arrow('1', 'hub', 'a'),
      arrow('2', 'b', 'hub'),
      arrow('3', 'hub', 'c'),
      arrow('4', 'a', 'b'),
    ];
    expect(pickMainElement(els)?.element.id).toBe('hub');
  });

  it('breaks a tie, or no arrows at all, by nearness to the area-weighted centre', () => {
    // A big sticky on the right pulls the weighted centre toward itself.
    const els = [
      shape('left', 0, 0),
      shape('middle', 500, 0),
      box('sticky', 'big', 1000, 0, 400, 400),
    ];
    expect(pickMainElement(els)?.element.id).toBe('big');
    const evenly = [shape('l', 0, 0), shape('m', 500, 0), shape('r', 1000, 0)];
    expect(pickMainElement(evenly)?.element.id).toBe('m');
  });

  it('never picks a title, a callout or a pen stroke while a shape is there', () => {
    const els = [
      box('text', 'title', 400, 0, 600, 80),
      box('annotation', 'note', 450, 200),
      box('freehand', 'ink', 500, 300),
      shape('corner', 0, 600),
    ];
    expect(pickMainElement(els)?.element.id).toBe('corner');
  });

  it('skips a frame covering over half the content, and falls back to everything when nothing is left', () => {
    const framed = [shape('frame', 0, 0, 1000, 1000), shape('a', 100, 100), shape('b', 800, 800)];
    expect(['a', 'b']).toContain(pickMainElement(framed)?.element.id);
    expect(pickMainElement(framed)?.element.id).not.toBe('frame');
    expect(pickMainElement([box('text', 't', 0, 0)])?.element.id).toBe('t');
    expect(pickMainElement([shape('only', 5, 5, 300, 300)])?.element.id).toBe('only');
  });

  it('returns the box of every boxed element', () => {
    const els = [shape('a', -50, 10), box('text', 't', 300, -20, 100, 20)];
    expect(pickMainElement(els)?.content).toEqual({ x: -50, y: -20, width: 450, height: 80 });
  });

  it('stays linear: 100,000 elements pick in well under a second', () => {
    const els: CanvasElement[] = [];
    for (let i = 0; i < 50_000; i += 1) {
      els.push(shape(`s${i}`, (i % 300) * 150, Math.floor(i / 300) * 100));
      els.push(arrow(`a${i}`, `s${i}`, `s${(i + 1) % 50_000}`));
    }
    const started = performance.now();
    pickMainElement(els);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe('focusView', () => {
  const size = { width: 390, height: 700 };
  const content = { x: 0, y: 0, width: 4000, height: 3000 };

  it('centres a normal node at 100%', () => {
    const view = focusView(size, content, { x: 2000, y: 1500, width: 160, height: 80 }, 60);
    expect(view.zoom).toBe(PHONE_FOCUS_MAX_ZOOM);
    expect(centreOf(view)).toEqual({ x: 2080, y: 1540 });
  });

  it('zooms out to show a big main element, never below the readable zoom', () => {
    const wide = focusView(size, content, { x: 1000, y: 1000, width: 300, height: 100 }, 60);
    expect(wide.zoom).toBeCloseTo(270 / 300);
    const huge = focusView(size, content, { x: 1000, y: 1000, width: 3000, height: 100 }, 60);
    expect(huge.zoom).toBe(PHONE_READABLE_ZOOM);
  });

  it('pulls toward the content when the main element sits at its edge, and keeps it on screen', () => {
    const main = { x: 0, y: 0, width: 100, height: 50 };
    const view = focusView(size, content, main, 60);
    const c = centreOf(view);
    // Visible padded span at 100%: 270 x 580, so the window starts at the content's corner.
    expect(c).toEqual({ x: 135, y: 290 });
    expect(main.x).toBeGreaterThanOrEqual(c.x - 135);
    expect(main.x + main.width).toBeLessThanOrEqual(c.x + 135);
  });

  it('centres an axis on the content when the content is narrower than the screen', () => {
    const tall = { x: 0, y: 0, width: 200, height: 3000 };
    const view = focusView(size, tall, { x: 50, y: 1500, width: 100, height: 50 }, 60);
    expect(centreOf(view).x).toBe(100);
    expect(centreOf(view).y).toBe(1525);
  });
});

describe('tabOpeningView', () => {
  const big = () => {
    const els: CanvasElement[] = [];
    for (let i = 0; i < 20; i += 1)
      els.push(shape(`s${i}`, (i % 5) * 400, Math.floor(i / 5) * 300));
    for (let i = 1; i < 20; i += 1) els.push(arrow(`a${i}`, 's7', `s${i === 7 ? 0 : i}`));
    return els;
  };

  it('is Fit to Screen off a phone', () => {
    const els = big();
    expect(tabOpeningView(canvas(), els, false)).toEqual(tabFitView(canvas(), els));
  });

  it('just fits a small diagram on a phone', () => {
    const els = [shape('a', 0, 0), shape('b', 0, 200)];
    const fit = tabFitView(canvas(), els)!;
    expect(fit.zoom).toBeGreaterThanOrEqual(PHONE_READABLE_ZOOM);
    expect(tabOpeningView(canvas(), els, true)).toEqual(fit);
  });

  it('focuses a big diagram on its main element at a readable zoom on a phone', () => {
    const els = big();
    expect(tabFitView(canvas(), els)!.zoom).toBeLessThan(PHONE_READABLE_ZOOM);
    const view = tabOpeningView(canvas(), els, true)!;
    expect(view.zoom).toBe(1);
    // s7 sits at (800, 300); its centre is (850, 325).
    expect(centreOf(view)).toEqual({ x: 850, y: 325 });
  });

  it('leaves an empty tab and an unmeasured canvas as Fit to Screen has them', () => {
    expect(tabOpeningView(canvas(), [], true)).toEqual({ zoom: 1, offset: { x: 0, y: 0 } });
    expect(tabOpeningView(null, big(), true)).toBeNull();
  });
});
